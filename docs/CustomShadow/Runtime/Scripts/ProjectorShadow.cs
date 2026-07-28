using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace CustomShadow02
{
    [ExecuteAlways]
    [AddComponentMenu("Rendering/Projector Shadow")]
    public class ProjectorShadow : MonoBehaviour
    {
        public enum ProjectorShadowQuality
        {
            Low = 0,
            Medium = 1,
            High = 2,
            Ultra = 3,
        }

        public enum BlurType
        {
            Kawase = 0,
            Gaussian = 1,
            Uniform = 2,
        }

        public enum BlurKernel
        {
            ThreeTap = 3,
            FiveTap = 5,
            SevenTap = 7,
        }

        public enum FadeInterpolationMode
        {
            Linear = 0,
            CurveLut = 1,
        }

        [SerializeField] public Light targetLight;
        [SerializeField] public ShadowControllerV2 shadowController;
        [SerializeField] public List<Renderer> projectorRenderers = new List<Renderer>();
        [SerializeField] public float bound = 1.0f;
        [SerializeField] public bool drawGizmos = false;
        [SerializeField] public ProjectorShadowQuality quality = ProjectorShadowQuality.High;

        [Header("Reuse ShadowMap")]
        [Tooltip("复用引擎 ShadowMap 深度生成 ProjectorShadow，省掉 DrawCasters 的 DrawCall。\n" +
                 "开启后不再自己渲染 caster，而是在 AfterShadowMap 阶段把深度纹理 blit 转换为颜色纹理。\n" +
                 "注意：复用模式下 _CameraProjectorMap 会包含 shadowmap 中所有 caster 的阴影，" +
                 "不仅仅是 projectorRenderers 列表中的对象。")]
        [SerializeField] public bool reuseShadowMap = false;

        [SerializeField] [Range(0.0f, 1.0f)] public float shadowStrength = 1.0f;
        [SerializeField] public bool enableBlur = false;
        [SerializeField] [Range(0.0f, 10.0f)] public float blurSize = 1.0f;
        [SerializeField] [Range(0, 10)] public int blurIterations = 2;
        [SerializeField] [Range(1.0f, 4.0f)] public float downSample = 1.0f;
        [SerializeField] public BlurType blurType = BlurType.Kawase;
        [SerializeField] public BlurKernel blurKernel = BlurKernel.SevenTap;

        [SerializeField] public bool enableBlurFade = false;
        [SerializeField] public FadeInterpolationMode fadeInterpolationMode = FadeInterpolationMode.Linear;
        [SerializeField] [Range(0.0f, 10.0f)] public float minBlurSize = 0.0f;
        [SerializeField] public Vector2 fadeDirection = new Vector2(0.0f, 1.0f);
        [SerializeField] [Range(0.0f, 2.0f)] public float fadeStart = 0.0f;
        [SerializeField] [Range(0.0f, 2.0f)] public float fadeEnd = 1.0f;
        [SerializeField] public AnimationCurve blurFadeCurve = AnimationCurve.Linear(0.0f, 0.0f, 1.0f, 1.0f);

        [SerializeField] public bool enableIntensityFade = false;
        [SerializeField] public Vector2 intensityFadeDirection = new Vector2(0.0f, 1.0f);
        [SerializeField] [Range(0.0f, 2.0f)] public float intensityFadeStart = 0.0f;
        [SerializeField] [Range(0.0f, 2.0f)] public float intensityFadeEnd = 1.0f;
        [SerializeField] public AnimationCurve intensityFadeCurve = AnimationCurve.Linear(0.0f, 1.0f, 1.0f, 0.0f);

        [Tooltip("X=light.shadowAttenuation，Y=EdgeColor 到材质 ShadowColor 的混合系数。仅 Curve LUT 模式生效。")]
        [SerializeField] public AnimationCurve shadowColorInterpolationCurve =
            AnimationCurve.Linear(0.0f, 0.0f, 1.0f, 1.0f);

        const string k_FallbackCasterShaderName = "Hidden/Theseus/ProjectorShadowCasterFallback";
        const string k_BlurShaderName = "Hidden/Theseus/ProjectorShadowBlur";
        const string k_DepthConvertShaderName = "Hidden/Theseus/ProjectorShadowDepthConvert";
        const int k_LutSize = 256;
        const string k_ProjectorShadowKeyword = "PROJECTOR_SHADOW_ON";
        const string k_FadeCurveLutKeyword = "PROJECTOR_SHADOW_FADE_CURVE_LUT";

        static readonly int CameraProjectorMapId = Shader.PropertyToID("_CameraProjectorMap");
        static readonly int CameraProjectorMapTexelSizeId = Shader.PropertyToID("_CameraProjectorMap_TexelSize");
        static readonly int CameraProjectorMapStId = Shader.PropertyToID("_CameraProjectorMap_ST");
        static readonly int ProjectionMatrixId = Shader.PropertyToID("_ProjectionMatrix");
        static readonly int ProjectorShadowParamsId = Shader.PropertyToID("_ProjectorShadowParams");
        static readonly int ProjectorIntensityFadeParamsId = Shader.PropertyToID("_ProjectorIntensityFadeParams");
        static readonly int ProjectorFadeCurveLutId = Shader.PropertyToID("_ProjectorFadeCurveLut");
        static readonly int ProjectorFadeReverseId = Shader.PropertyToID("_ProjectorFadeReverse");
        static readonly int OffsetId = Shader.PropertyToID("_Offset");
        static readonly int BlurDirId = Shader.PropertyToID("_BlurDir");
        static readonly int BlurWeightsId = Shader.PropertyToID("_GaussWeights");
        static readonly int BlurOffsetsId = Shader.PropertyToID("_GaussOffsets");
        static readonly int BlurFadeParamsId = Shader.PropertyToID("_BlurFadeParams");
        static readonly int VariableBlurMinRatioId = Shader.PropertyToID("_VariableBlurMinRatio");
        static readonly int TempBlurAId = Shader.PropertyToID("_ProjectorShadowTempA");
        static readonly int TempBlurBId = Shader.PropertyToID("_ProjectorShadowTempB");
        static readonly int ShadowMapDepthId = Shader.PropertyToID("_ShadowMapDepth");

        RenderTexture m_ProjectorMap;
        CommandBuffer m_CommandBuffer;
        CommandBuffer m_AfterShadowMapCB;
        Material m_FallbackCasterMaterial;
        Material m_BlurMaterial;
        Material m_DepthConvertMaterial;
        Texture2D m_FadeCurveLut;
        int m_LastMapSize = -1;
        bool m_WarnedMissingFallback;
        bool m_PrevReuseShadowMap;

        // ProjectorShadow is global shader state. Keep the keyword enabled while
        // at least one valid component is actively publishing a projector map.
        static readonly HashSet<ProjectorShadow> s_ActiveProjectorShadows = new HashSet<ProjectorShadow>();

        #region ShadowSoftnessLink
        [SerializeField] public bool enableShadowSoftnessLink = false;
        
        [Header("Area Range")]
        [SerializeField] public float minArea = 0.01f;
        [SerializeField] public float maxArea = 100.0f;
        [SerializeField] public float areaPower = 1.0f;
        
        [Header("ProjectorShadow - Blur Size")]
        [SerializeField] public float minBlurSizeLink = 0.0f;
        [SerializeField] public float maxBlurSizeLink = 10.0f;

        [Header("ProjectorShadow - Blur Iterations")]
        [SerializeField] public int minBlurIterations = 0;
        [SerializeField] public int maxBlurIterations = 10;

        [Header("ProjectorShadow - Down Sample")]
        [SerializeField] public float minDownSample = 1.0f;
        [SerializeField] public float maxDownSample = 4.0f;

        [Header("ProjectorShadow - Blur Fade")]
        [SerializeField] public float minMinBlurSize = 0.0f;
        [SerializeField] public float maxMinBlurSize = 10.0f;
        [SerializeField] public float minFadeStart = 0.0f;
        [SerializeField] public float maxFadeStart = 2.0f;
        [SerializeField] public float minFadeEnd = 0.0f;
        [SerializeField] public float maxFadeEnd = 2.0f;

        [Header("ProjectorShadow - Intensity Fade")]
        [SerializeField] public float minIntensityFadeStart = 0.0f;
        [SerializeField] public float maxIntensityFadeStart = 2.0f;
        [SerializeField] public float minIntensityFadeEnd = 0.0f;
        [SerializeField] public float maxIntensityFadeEnd = 2.0f;

        #endregion
        
        void OnEnable()
        {
            ResolveShadowController();
            EnsureResources();
            UpdateFadeCurveLut();
            m_PrevReuseShadowMap = !reuseShadowMap; // force re-hook on first LateUpdate
            UpdateProjectorShadowKeyword(IsProjectorShadowOperational());
        }

        void OnValidate()
        {
            shadowStrength = Mathf.Clamp01(shadowStrength);
            ResolveShadowController();
            EnsureResources();
            UpdateFadeCurveLut();
            UpdateProjectorShadowKeyword(IsProjectorShadowOperational());
        }

        void OnDisable()
        {
            UpdateProjectorShadowKeyword(false);
            UnhookAfterShadowMap();
            ReleaseResources();
        }

        void OnDestroy()
        {
            UpdateProjectorShadowKeyword(false);
            ReleaseResources();
        }

        void LateUpdate()
        {
            // 联动状态下，ShadowController 关闭时 ProjectorShadow 也随之失效
            if (!isActiveAndEnabled || targetLight == null ||
                (shadowController != null && !shadowController.isActiveAndEnabled))
            {
                UpdateProjectorShadowKeyword(false);
                UnhookAfterShadowMap();
                return;
            }
            UpdateProjectorShadowKeyword(true);
            ApplyLink();
            EnsureResources();

            // Re-hook AfterShadowMap CB when reuseShadowMap toggle changes
            if (m_PrevReuseShadowMap != reuseShadowMap)
            {
                UnhookAfterShadowMap();
                m_PrevReuseShadowMap = reuseShadowMap;
            }

            if (reuseShadowMap)
            {
                // Reuse mode: build AfterShadowMap CB, actual render happens during light pass
                BuildReuseCommandBuffer();
            }
            else
            {
                // Original mode: self-render via DrawCasters
                UnhookAfterShadowMap();
                RenderProjectorMap();
            }
        }

        void UpdateProjectorShadowKeyword(bool enabled)
        {
            s_ActiveProjectorShadows.RemoveWhere(projectorShadow => projectorShadow == null);

            if (enabled)
                s_ActiveProjectorShadows.Add(this);
            else
                s_ActiveProjectorShadows.Remove(this);

            if (s_ActiveProjectorShadows.Count > 0)
            {
                Shader.EnableKeyword(k_ProjectorShadowKeyword);
            }
            else
            {
                Shader.DisableKeyword(k_ProjectorShadowKeyword);
                Shader.DisableKeyword(k_FadeCurveLutKeyword);
                Shader.SetGlobalVector(ProjectorShadowParamsId, Vector4.zero);
            }
        }

        bool IsProjectorShadowOperational()
        {
            return isActiveAndEnabled && targetLight != null &&
                   (shadowController == null || shadowController.isActiveAndEnabled);
        }

        public int GetMapSize()
        {
            switch (quality)
            {
                case ProjectorShadowQuality.Low: return 128;
                case ProjectorShadowQuality.Medium: return 256;
                case ProjectorShadowQuality.High: return 512;
                case ProjectorShadowQuality.Ultra: return 1024;
                default: return 512;
            }
        }

        public Matrix4x4 GetViewProjectionMatrix()
        {
            if (targetLight == null)
                return Matrix4x4.identity;

            int mapSize = GetMapSize();
            if (TryGetSpotOnlyShadowSettings(out float spotOnlyAngle, out float spotOnlyRange))
                return ExtractSpotProjectorMatrix(mapSize, spotOnlyAngle, spotOnlyRange);
            if (targetLight.type == LightType.Directional)
            {
                // Reuse mode must use the exact matrix that ShadowController used
                // when Unity generated the directional shadow map. Rebuilding a
                // second directional matrix here can differ in view basis, rounding,
                // or platform Y convention and causes a mirrored projector sample.
                if (reuseShadowMap && shadowController != null &&
                    shadowController.targetLight == targetLight)
                {
                    return GetShadowTransform(
                        shadowController.ShadowProjectionMatrix,
                        shadowController.ShadowViewMatrix);
                }
                return ExtractDirectionalProjectorMatrix(mapSize);
            }
            if (targetLight.type == LightType.Spot)
                return ExtractSpotProjectorMatrix(mapSize, targetLight.spotAngle, targetLight.range);

            return Matrix4x4.identity;
        }

        bool TryGetSpotOnlyShadowSettings(out float spotAngle, out float range)
        {
            spotAngle = 0.0f;
            range = 0.0f;

            if (targetLight == null)
                return false;

            MTAdditionalLightData additionalLightData = targetLight.GetComponent<MTAdditionalLightData>();
            if (additionalLightData == null ||
                (additionalLightData.CurrentLightType != MTLightType.SpotOnlyShadow &&
                 additionalLightData.CurrentLightType != MTLightType.SpotVirtual))
                return false;

            spotAngle = additionalLightData.SpotAngle;
            range = additionalLightData.Range;
            return spotAngle > 0.0f && range > 0.0f;
        }

        bool IsSpotProjector()
        {
            return targetLight != null &&
                (targetLight.type == LightType.Spot ||
                 TryGetSpotOnlyShadowSettings(out _, out _));
        }

        void ResolveShadowController()
        {
            if (shadowController == null)
                shadowController = GetComponent<ShadowControllerV2>();

            if (shadowController != null && shadowController.targetLight != targetLight)
                targetLight = shadowController.targetLight;
        }

        void GetProjectionSphere(out Vector3 spherePos, out float sphereRadius)
        {
            if (shadowController != null)
            {
                float scale = shadowController.transform.lossyScale.x;
                spherePos = shadowController.spherePosition * scale + shadowController.transform.position;
                sphereRadius = Mathf.Max(0.001f, shadowController.sphereRadius * scale);
                return;
            }

            spherePos = transform.position;
            sphereRadius = Mathf.Max(0.001f, bound * transform.lossyScale.x);
        }

        void EnsureResources()
        {
            if (m_CommandBuffer == null)
                m_CommandBuffer = new CommandBuffer { name = "Projector Shadow" };

            int mapSize = GetMapSize();
            if (m_ProjectorMap == null || m_LastMapSize != mapSize)
            {
                ReleaseProjectorMap();
                RenderTextureFormat format = GetProjectorMapFormat();
                m_ProjectorMap = new RenderTexture(mapSize, mapSize, 16, format)
                {
                    name = "_CameraProjectorMap",
                    filterMode = FilterMode.Bilinear,
                    wrapMode = TextureWrapMode.Clamp,
                    useMipMap = false,
                    autoGenerateMips = false,
                };
                m_ProjectorMap.Create();
                m_LastMapSize = mapSize;
            }

            if (m_FallbackCasterMaterial == null)
            {
                Shader shader = Shader.Find(k_FallbackCasterShaderName);
                if (shader != null)
                    m_FallbackCasterMaterial = new Material(shader) { hideFlags = HideFlags.HideAndDontSave };
            }

            if (m_BlurMaterial == null)
            {
                Shader shader = Shader.Find(k_BlurShaderName);
                if (shader != null)
                    m_BlurMaterial = new Material(shader) { hideFlags = HideFlags.HideAndDontSave };
            }

            if (m_DepthConvertMaterial == null)
            {
                Shader shader = Shader.Find(k_DepthConvertShaderName);
                if (shader != null)
                    m_DepthConvertMaterial = new Material(shader) { hideFlags = HideFlags.HideAndDontSave };
            }
        }

        void ReleaseResources()
        {
            UnhookAfterShadowMap();

            if (m_CommandBuffer != null)
            {
                m_CommandBuffer.Release();
                m_CommandBuffer = null;
            }

            ReleaseProjectorMap();
            DestroyObject(m_FallbackCasterMaterial);
            DestroyObject(m_BlurMaterial);
            DestroyObject(m_DepthConvertMaterial);
            DestroyObject(m_FadeCurveLut);
            m_FallbackCasterMaterial = null;
            m_BlurMaterial = null;
            m_DepthConvertMaterial = null;
            m_FadeCurveLut = null;
        }

        void HookAfterShadowMap()
        {
            if (m_AfterShadowMapCB != null || targetLight == null)
                return;

            m_AfterShadowMapCB = new CommandBuffer { name = "ProjectorShadow Reuse" };
            targetLight.AddCommandBuffer(LightEvent.AfterShadowMap, m_AfterShadowMapCB);
        }

        void UnhookAfterShadowMap()
        {
            if (m_AfterShadowMapCB != null)
            {
                if (targetLight != null)
                    targetLight.RemoveCommandBuffer(LightEvent.AfterShadowMap, m_AfterShadowMapCB);
                m_AfterShadowMapCB.Release();
                m_AfterShadowMapCB = null;
            }
        }

        void BuildReuseCommandBuffer()
        {
            if (m_ProjectorMap == null || m_DepthConvertMaterial == null)
                return;

            HookAfterShadowMap();
            if (m_AfterShadowMapCB == null)
                return;

            CommandBuffer cmd = m_AfterShadowMapCB;
            cmd.Clear();

            // Set the variant before recording blur passes so curve mode is used by this frame.
            ApplyFadeInterpolationMode(cmd);

            // When blur is enabled, skip the intermediate DepthConvert → m_ProjectorMap blit
            // and let ApplyBlur do DepthConvert directly into TempBlurA via Blur shader Pass 0,
            // saving one full-screen blit.
            if (enableBlur && blurIterations > 0 && blurSize > 0.0f && m_BlurMaterial != null)
            {
                ApplyBlur(cmd, firstPassIsDepthConvert: true);
            }
            else
            {
                // No blur: DepthConvert directly into m_ProjectorMap.
                // IMPORTANT: bind _ShadowMapDepth to the current shadowmap RT BEFORE switching
                // render target. AfterShadowMap event starts with CurrentActive == shadowmap,
                // but SetRenderTarget(m_ProjectorMap) would change the active RT, making a
                // subsequent CurrentActive reference point to the cleared m_ProjectorMap
                // instead of the shadowmap, which would lose all shadow data.
                //
                // The DepthConvert shader samples _ShadowMapDepth (not _MainTex), so the Blit
                // source is irrelevant to the shader output. We pass m_ProjectorMap as source
                // purely to satisfy the API; it is never actually sampled.
                cmd.SetGlobalTexture(ShadowMapDepthId, BuiltinRenderTextureType.CurrentActive);
                cmd.SetRenderTarget(m_ProjectorMap);
                cmd.ClearRenderTarget(true, true, Color.white);
                cmd.Blit(m_ProjectorMap, m_ProjectorMap, m_DepthConvertMaterial, 0);
            }

            // Set global params (same as RenderProjectorMap)
            Vector4 texelSize = new Vector4(1.0f / m_ProjectorMap.width, 1.0f / m_ProjectorMap.height, m_ProjectorMap.width, m_ProjectorMap.height);
            Vector2 fadeDir = intensityFadeDirection == Vector2.zero ? Vector2.up : intensityFadeDirection.normalized;
            cmd.SetGlobalTexture(CameraProjectorMapId, m_ProjectorMap);
            cmd.SetGlobalVector(CameraProjectorMapTexelSizeId, texelSize);
            // The fullscreen depth conversion already preserves the native shadow-map
            // orientation. Do not derive an X flip from graphicsUVStartsAtTop: that flag
            // describes render-texture Y conventions, not the light-space X basis. Applying
            // it here mirrors the directional shadow horizontally on DX/Vulkan/Metal.
            cmd.SetGlobalVector(CameraProjectorMapStId, new Vector4(1.0f, 1.0f, 0.0f, 0.0f));
            cmd.SetGlobalVector(ProjectorShadowParamsId, new Vector4(1.0f, shadowStrength, enableIntensityFade ? 1.0f : 0.0f, 0.0f));
            cmd.SetGlobalFloat(ProjectorFadeReverseId, IsSpotProjector() ? 0.0f : 1.0f);
            cmd.SetGlobalVector(ProjectorIntensityFadeParamsId, new Vector4(fadeDir.x, fadeDir.y, intensityFadeStart, intensityFadeEnd));

            // Reuse mode: _ProjectionMatrix must match the shadowmap VP matrix.
            // ShadowController already sets customShadowViewM / customShadowProjM globals;
            // the receiver shader uses _ProjectionMatrix which is set by RenderProjectorMap in
            // original mode. In reuse mode we set it here from the same source.
            Matrix4x4 projectorVPBiased = GetViewProjectionMatrix();
            cmd.SetGlobalMatrix(ProjectionMatrixId, projectorVPBiased);
        }

        void ReleaseProjectorMap()
        {
            if (m_ProjectorMap == null)
                return;

            m_ProjectorMap.Release();
            DestroyObject(m_ProjectorMap);
            m_ProjectorMap = null;
            m_LastMapSize = -1;
        }

        static void DestroyObject(UnityEngine.Object obj)
        {
            if (obj == null)
                return;

            if (Application.isPlaying)
                Destroy(obj);
            else
                DestroyImmediate(obj);
        }

        void RenderProjectorMap()
        {
            if (m_CommandBuffer == null || m_ProjectorMap == null)
                return;

            Matrix4x4 projectorVPBiased = GetViewProjectionMatrix();
            Matrix4x4 biasInv = Matrix4x4.identity;
            biasInv.m00 = 2.0f;
            biasInv.m11 = 2.0f;
            biasInv.m22 = 2.0f;
            biasInv.m03 = -1.0f;
            biasInv.m13 = -1.0f;
            biasInv.m23 = -1.0f;
            Matrix4x4 projectorVPNoBias = biasInv * projectorVPBiased;

            m_CommandBuffer.Clear();
            ApplyFadeInterpolationMode(m_CommandBuffer);
            m_CommandBuffer.SetRenderTarget(m_ProjectorMap);
            m_CommandBuffer.ClearRenderTarget(true, true, Color.white);
            m_CommandBuffer.SetGlobalMatrix(ProjectionMatrixId, projectorVPBiased);
            m_CommandBuffer.SetViewProjectionMatrices(Matrix4x4.identity, projectorVPNoBias);
            DrawCasters(m_CommandBuffer);

            if (enableBlur && blurIterations > 0 && blurSize > 0.0f && m_BlurMaterial != null)
                ApplyBlur(m_CommandBuffer);

            Vector4 texelSize = new Vector4(1.0f / m_ProjectorMap.width, 1.0f / m_ProjectorMap.height, m_ProjectorMap.width, m_ProjectorMap.height);
            Vector2 fadeDir = intensityFadeDirection == Vector2.zero ? Vector2.up : intensityFadeDirection.normalized;
            m_CommandBuffer.SetGlobalTexture(CameraProjectorMapId, m_ProjectorMap);
            m_CommandBuffer.SetGlobalVector(CameraProjectorMapTexelSizeId, texelSize);
            m_CommandBuffer.SetGlobalVector(CameraProjectorMapStId, new Vector4(1.0f, 1.0f, 0.0f, 0.0f));
            m_CommandBuffer.SetGlobalVector(ProjectorShadowParamsId, new Vector4(1.0f, shadowStrength, enableIntensityFade ? 1.0f : 0.0f, 0.0f));
            m_CommandBuffer.SetGlobalFloat(ProjectorFadeReverseId, IsSpotProjector() ? 0.0f : 1.0f);
            m_CommandBuffer.SetGlobalVector(ProjectorIntensityFadeParamsId, new Vector4(fadeDir.x, fadeDir.y, intensityFadeStart, intensityFadeEnd));

            Graphics.ExecuteCommandBuffer(m_CommandBuffer);
        }

        void DrawCasters(CommandBuffer cmd)
        {
            for (int i = 0; i < projectorRenderers.Count; i++)
            {
                Renderer renderer = projectorRenderers[i];
                if (renderer == null || !renderer.enabled || !renderer.gameObject.activeInHierarchy)
                    continue;
                if (renderer.shadowCastingMode == ShadowCastingMode.Off)
                    continue;

                Material[] materials = renderer.sharedMaterials;
                int subMeshCount = Math.Max(1, materials.Length);
                for (int subMesh = 0; subMesh < subMeshCount; subMesh++)
                {
                    Material material = subMesh < materials.Length ? materials[subMesh] : null;
                    if (material != null && material.renderQueue > (int)RenderQueue.GeometryLast)
                        continue;

                    if (m_FallbackCasterMaterial != null)
                    {
                        cmd.DrawRenderer(renderer, m_FallbackCasterMaterial, subMesh, 0);
                    }
                    else if (!m_WarnedMissingFallback)
                    {
                        Debug.LogWarning("ProjectorShadow fallback caster shader is missing.");
                        m_WarnedMissingFallback = true;
                    }
                }
            }
        }

        // Pass indices in ProjectorShadowBlur.shader:
        //   0 = DepthConvert, 1 = Copy, 2 = Kawase, 3 = Separable, 4 = VariableKawase, 5 = VariableSeparable
        const int k_BlurPassDepthConvert = 0;
        const int k_BlurPassCopy = 1;
        const int k_BlurPassKawase = 2;
        const int k_BlurPassSeparable = 3;
        const int k_BlurPassVariableKawase = 4;
        const int k_BlurPassVariableSeparable = 5;

        void ApplyBlur(CommandBuffer cmd, bool firstPassIsDepthConvert = false)
        {
            float ds = Mathf.Clamp(downSample, 1.0f, 4.0f);
            int rtW = Mathf.Max(32, Mathf.RoundToInt(m_ProjectorMap.width / ds));
            int rtH = Mathf.Max(32, Mathf.RoundToInt(m_ProjectorMap.height / ds));
            Vector4 texelSize = new Vector4(1.0f / rtW, 1.0f / rtH, rtW, rtH);

            RenderTextureFormat format = GetProjectorMapFormat();
            cmd.GetTemporaryRT(TempBlurAId, rtW, rtH, 0, FilterMode.Bilinear, format);
            cmd.GetTemporaryRT(TempBlurBId, rtW, rtH, 0, FilterMode.Bilinear, format);

            cmd.SetGlobalVector(CameraProjectorMapTexelSizeId, texelSize);

            // First pass: DepthConvert (reuse mode, from shadowmap) or Copy (normal mode, from m_ProjectorMap)
            int firstPass = firstPassIsDepthConvert ? k_BlurPassDepthConvert : k_BlurPassCopy;
            if (firstPassIsDepthConvert)
            {
                // Ensure _ShadowMapDepth points to the current shadowmap RT for DepthConvertFrag
                cmd.SetGlobalTexture(ShadowMapDepthId, BuiltinRenderTextureType.CurrentActive);
                cmd.Blit(BuiltinRenderTextureType.CurrentActive, TempBlurAId, m_BlurMaterial, firstPass);
            }
            else
            {
                cmd.SetGlobalTexture(CameraProjectorMapId, m_ProjectorMap);
                cmd.Blit(m_ProjectorMap, TempBlurAId, m_BlurMaterial, firstPass);
            }

            int src = TempBlurAId;
            int dst = TempBlurBId;
            bool useFade = enableBlurFade;
            if (useFade)
            {
                Vector2 blurFadeDir = fadeDirection == Vector2.zero ? Vector2.up : fadeDirection.normalized;
                cmd.SetGlobalVector(BlurFadeParamsId, new Vector4(blurFadeDir.x, blurFadeDir.y, fadeStart, fadeEnd));
                cmd.SetGlobalFloat(VariableBlurMinRatioId, minBlurSize);
                if (m_FadeCurveLut != null)
                    cmd.SetGlobalTexture(ProjectorFadeCurveLutId, m_FadeCurveLut);
            }

            if (blurType == BlurType.Kawase)
            {
                int kawasePass = useFade ? k_BlurPassVariableKawase : k_BlurPassKawase;
                for (int i = 0; i < blurIterations; i++)
                {
                    cmd.SetGlobalFloat(OffsetId, i + 1.0f + blurSize);
                    cmd.SetGlobalTexture(CameraProjectorMapId, src);
                    cmd.SetGlobalVector(CameraProjectorMapTexelSizeId, texelSize);
                    cmd.Blit(src, dst, m_BlurMaterial, kawasePass);
                    Swap(ref src, ref dst);
                }
            }
            else
            {
                bool gaussian = blurType == BlurType.Gaussian;
                int taps = (int)blurKernel;
                Vector4 weights = Vector4.zero;
                Vector4 offsets = Vector4.zero;
                int separablePass = useFade ? k_BlurPassVariableSeparable : k_BlurPassSeparable;

                for (int i = 0; i < blurIterations; i++)
                {
                    float radius = i + 1.0f + blurSize;
                    ComputeSeparableWeights(radius, taps, gaussian, ref weights, ref offsets);
                    cmd.SetGlobalVector(BlurWeightsId, weights);
                    cmd.SetGlobalVector(BlurOffsetsId, offsets);
                    cmd.SetGlobalVector(CameraProjectorMapTexelSizeId, texelSize);

                    cmd.SetGlobalVector(BlurDirId, new Vector2(1.0f, 0.0f));
                    cmd.SetGlobalTexture(CameraProjectorMapId, src);
                    cmd.Blit(src, dst, m_BlurMaterial, separablePass);
                    Swap(ref src, ref dst);

                    cmd.SetGlobalVector(BlurDirId, new Vector2(0.0f, 1.0f));
                    cmd.SetGlobalTexture(CameraProjectorMapId, src);
                    cmd.Blit(src, dst, m_BlurMaterial, separablePass);
                    Swap(ref src, ref dst);
                }
            }

            cmd.SetGlobalTexture(CameraProjectorMapId, src);
            cmd.SetGlobalVector(CameraProjectorMapTexelSizeId, new Vector4(1.0f / m_ProjectorMap.width, 1.0f / m_ProjectorMap.height, m_ProjectorMap.width, m_ProjectorMap.height));
            cmd.Blit(src, m_ProjectorMap, m_BlurMaterial, k_BlurPassCopy);
            cmd.ReleaseTemporaryRT(TempBlurAId);
            cmd.ReleaseTemporaryRT(TempBlurBId);
        }

        static void Swap(ref int a, ref int b)
        {
            int tmp = a;
            a = b;
            b = tmp;
        }

        static void ComputeSeparableWeights(float radius, int taps, bool gaussian, ref Vector4 weights, ref Vector4 offsets)
        {
            taps = Mathf.Clamp(taps, 3, 7);
            float sigma = Mathf.Max(0.001f, radius * 0.6f);

            float w0 = 1.0f;
            float w1 = 1.0f;
            float w2 = taps >= 5 ? 1.0f : 0.0f;
            float w3 = taps >= 7 ? 1.0f : 0.0f;

            if (gaussian)
            {
                float inv2Sigma2 = 1.0f / (2.0f * sigma * sigma);
                w0 = Mathf.Exp(0.0f);
                w1 = Mathf.Exp(-(1.0f * 1.0f) * inv2Sigma2);
                w2 = taps >= 5 ? Mathf.Exp(-(2.0f * 2.0f) * inv2Sigma2) : 0.0f;
                w3 = taps >= 7 ? Mathf.Exp(-(3.0f * 3.0f) * inv2Sigma2) : 0.0f;
            }

            float sum = w0 + 2.0f * (w1 + w2 + w3);
            float invSum = sum > 0.0f ? 1.0f / sum : 1.0f;

            weights.x = w0 * invSum;
            weights.y = w1 * invSum;
            weights.z = w2 * invSum;
            weights.w = w3 * invSum;

            offsets.x = radius;
            offsets.y = taps >= 5 ? radius * 2.0f : 0.0f;
            offsets.z = taps >= 7 ? radius * 3.0f : 0.0f;
            offsets.w = 0.0f;
        }

        public void UpdateFadeCurveLut()
        {
            bool useCurveLut = fadeInterpolationMode == FadeInterpolationMode.CurveLut;
            if (!useCurveLut)
            {
                DestroyObject(m_FadeCurveLut);
                m_FadeCurveLut = null;
                return;
            }

            if (m_FadeCurveLut == null)
            {
                m_FadeCurveLut = new Texture2D(k_LutSize, 1, TextureFormat.RGBA32, false, true)
                {
                    hideFlags = HideFlags.HideAndDontSave,
                    wrapMode = TextureWrapMode.Clamp,
                    filterMode = FilterMode.Bilinear,
                    name = "ProjectorFadeCurveLUT",
                };
            }

            Color32[] pixels = new Color32[k_LutSize];
            for (int i = 0; i < k_LutSize; i++)
            {
                float t = i / (float)(k_LutSize - 1);
                float blurValue = blurFadeCurve == null ? t : blurFadeCurve.Evaluate(t);
                float intensityValue = intensityFadeCurve == null ? t : intensityFadeCurve.Evaluate(t);
                float colorValue = shadowColorInterpolationCurve == null ? t : shadowColorInterpolationCurve.Evaluate(t);
                byte blur = (byte)(Mathf.Clamp01(blurValue) * 255.0f + 0.5f);
                byte intensity = (byte)(Mathf.Clamp01(intensityValue) * 255.0f + 0.5f);
                byte color = (byte)(Mathf.Clamp01(colorValue) * 255.0f + 0.5f);
                pixels[i] = new Color32(blur, intensity, color, 255);
            }
            m_FadeCurveLut.SetPixels32(pixels);
            m_FadeCurveLut.Apply(false, false);
        }

        void ApplyFadeInterpolationMode(CommandBuffer cmd)
        {
            bool useCurveLut = fadeInterpolationMode == FadeInterpolationMode.CurveLut;
            if (useCurveLut)
            {
                Shader.EnableKeyword(k_FadeCurveLutKeyword);
                if (m_BlurMaterial != null)
                    m_BlurMaterial.EnableKeyword(k_FadeCurveLutKeyword);
                if (m_FadeCurveLut != null)
                    cmd.SetGlobalTexture(ProjectorFadeCurveLutId, m_FadeCurveLut);
            }
            else
            {
                Shader.DisableKeyword(k_FadeCurveLutKeyword);
                if (m_BlurMaterial != null)
                    m_BlurMaterial.DisableKeyword(k_FadeCurveLutKeyword);
            }
        }

        static RenderTextureFormat GetProjectorMapFormat()
        {
            return SystemInfo.SupportsRenderTextureFormat(RenderTextureFormat.R8)
                ? RenderTextureFormat.R8
                : RenderTextureFormat.ARGB32;
        }

        Matrix4x4 ExtractDirectionalProjectorMatrix(int mapSize)
        {
            GetProjectionSphere(out Vector3 spherePos, out float radius);

            Vector3 lightForwardDir = -targetLight.transform.forward;
            Vector3 lightUpDir = Vector3.up;
            if (Mathf.Abs(Vector3.Dot(lightUpDir, lightForwardDir)) > 1.0f - 1e-2f)
                lightUpDir = Vector3.forward;

            Matrix4x4 projMatrix = ShadowUtils.CreateDXOrthoMatrix(-radius, radius, -radius, radius, -15.0f, 15.0f);
            Matrix4x4 viewMatrix = Matrix4x4.LookAt(spherePos, spherePos + lightForwardDir, lightUpDir).inverse;
            ShadowUtils.FlipZ(ref viewMatrix);
            ShadowUtils.FlipY(ref viewMatrix);

            Matrix4x4 roundingMat = ShadowUtils.CalculateRoundingMatrix(projMatrix, viewMatrix, new Vector2(mapSize, mapSize));
            projMatrix = roundingMat * projMatrix;
            return GetShadowTransform(projMatrix, viewMatrix);
        }

        Matrix4x4 ExtractSpotProjectorMatrix(int mapSize, float spotAngle, float range)
        {
            // Reuse ShadowController's already-computed matrix (includes crop + rounding).
            if (shadowController != null && shadowController.targetLight == targetLight)
                return GetShadowTransform(shadowController.ShadowProjectionMatrix, shadowController.ShadowViewMatrix);

            Vector3 lightPos = targetLight.transform.position;
            Vector3 lightForwardDir = targetLight.transform.forward;
            Vector3 lightUpDir = Vector3.up;
            if (Mathf.Abs(Vector3.Dot(lightUpDir, lightForwardDir)) > 1.0f - 1e-2f)
                lightUpDir = Vector3.forward;

            float far = Mathf.Max(0.151f, range);
            Matrix4x4 projMatrix = Matrix4x4.Perspective(spotAngle, 1.0f, 0.15f, far);
            projMatrix = GL.GetGPUProjectionMatrix(projMatrix, false);
            Matrix4x4 viewMatrix = Matrix4x4.LookAt(lightPos, lightPos + lightForwardDir, lightUpDir).inverse;
            ShadowUtils.FlipZ(ref viewMatrix);
            ShadowUtils.FlipY(ref viewMatrix);

            Matrix4x4 roundingMat = ShadowUtils.CalculateRoundingMatrix(projMatrix, viewMatrix, new Vector2(mapSize, mapSize));
            projMatrix = roundingMat * projMatrix;
            return GetShadowTransform(projMatrix, viewMatrix);
        }

        static Matrix4x4 GetShadowTransform(Matrix4x4 proj, Matrix4x4 view)
        {
            Matrix4x4 worldToShadow = proj * view;
            Matrix4x4 textureScaleAndBias = Matrix4x4.identity;
            textureScaleAndBias.m00 = 0.5f;
            textureScaleAndBias.m11 = 0.5f;
            textureScaleAndBias.m22 = 0.5f;
            textureScaleAndBias.m03 = 0.5f;
            textureScaleAndBias.m13 = 0.5f;
            textureScaleAndBias.m23 = 0.5f;
            return textureScaleAndBias * worldToShadow;
        }

        void OnDrawGizmos()
        {
            if (!drawGizmos)
                return;

            GetProjectionSphere(out Vector3 spherePos, out float sphereRadius);
            Gizmos.color = new Color(1.0f, 1.0f, 0.0f, 0.35f);
            Gizmos.DrawSphere(spherePos, sphereRadius);
        }


        #region ShadowSoftnessLink
        private void ClampSerializedValues()
        {
            minArea = Mathf.Max(0.0001f, minArea);
            maxArea = Mathf.Max(minArea, maxArea);
            areaPower = Mathf.Max(0.0001f, areaPower);

            minBlurSizeLink = Mathf.Max(0.0f, minBlurSizeLink);
            maxBlurSizeLink = Mathf.Max(minBlurSizeLink, maxBlurSizeLink);

            minBlurIterations = Mathf.Clamp(minBlurIterations, 0, 10);
            maxBlurIterations = Mathf.Clamp(maxBlurIterations, minBlurIterations, 10);

            minDownSample = Mathf.Clamp(minDownSample, 1.0f, 4.0f);
            maxDownSample = Mathf.Clamp(maxDownSample, minDownSample, 4.0f);

            minMinBlurSize = Mathf.Max(0.0f, minMinBlurSize);
            maxMinBlurSize = Mathf.Max(minMinBlurSize, maxMinBlurSize);

            minFadeStart = Mathf.Clamp(minFadeStart, 0.0f, 2.0f);
            maxFadeStart = Mathf.Clamp(maxFadeStart, minFadeStart, 2.0f);
            minFadeEnd = Mathf.Clamp(minFadeEnd, 0.0f, 2.0f);
            maxFadeEnd = Mathf.Clamp(maxFadeEnd, minFadeEnd, 2.0f);

            minIntensityFadeStart = Mathf.Clamp(minIntensityFadeStart, 0.0f, 2.0f);
            maxIntensityFadeStart = Mathf.Clamp(maxIntensityFadeStart, minIntensityFadeStart, 2.0f);
            minIntensityFadeEnd = Mathf.Clamp(minIntensityFadeEnd, 0.0f, 2.0f);
            maxIntensityFadeEnd = Mathf.Clamp(maxIntensityFadeEnd, minIntensityFadeEnd, 2.0f);

        }
        
        /// <summary>
        /// Apply all min* snapshot values to current ProjectorShadow parameters (Sharpest configuration).
        /// </summary>
        public void ApplyMinLinkValues() 
        {
            blurSize = minBlurSizeLink;
            blurIterations = minBlurIterations;
            downSample = minDownSample;

            minBlurSize = minMinBlurSize;
            fadeStart = minFadeStart;
            fadeEnd = minFadeEnd;

            intensityFadeStart = minIntensityFadeStart;
            intensityFadeEnd = minIntensityFadeEnd;

        }

        /// <summary>
        /// Apply all max* snapshot values to current ProjectorShadow parameters (Blurriest configuration).
        /// </summary>
        public void ApplyMaxLinkValues()
        {
            blurSize = maxBlurSizeLink;
            blurIterations = maxBlurIterations;
            downSample = maxDownSample;

            minBlurSize = maxMinBlurSize;
            fadeStart = maxFadeStart;
            fadeEnd = maxFadeEnd;

            intensityFadeStart = maxIntensityFadeStart;
            intensityFadeEnd = maxIntensityFadeEnd;

        }

        /// <summary>
        /// Capture all current ProjectorShadow parameters as the min* snapshot.
        /// </summary>
        public void CaptureAsMin()
        {
            minBlurSizeLink = blurSize;
            minBlurIterations = blurIterations;
            minDownSample = downSample;

            minMinBlurSize = minBlurSize;
            minFadeStart = fadeStart;
            minFadeEnd = fadeEnd;

            minIntensityFadeStart = intensityFadeStart;
            minIntensityFadeEnd = intensityFadeEnd;

        }

        /// <summary>
        /// Capture all current ProjectorShadow parameters as the max* snapshot.
        /// </summary>
        public void CaptureAsMax()
        {
            maxBlurSizeLink = blurSize;
            maxBlurIterations = blurIterations;
            maxDownSample = downSample;

            maxMinBlurSize = minBlurSize;
            maxFadeStart = fadeStart;
            maxFadeEnd = fadeEnd;

            maxIntensityFadeStart = intensityFadeStart;
            maxIntensityFadeEnd = intensityFadeEnd;

        }

        private void ApplyLink()
        {
            return;

            //  TODOD AREA LIGHT
            //if(enableShadowSoftnessLink == false)
            //    return;
            
            //if (targetLight == null)
            //    return;

            //targetLight.TryGetComponent(out AreaLight areaLight);
            //if(areaLight == null)
            //    return;

            //ClampSerializedValues();
            
            //float area = Mathf.Max(0.0f, areaLight.LightWidth * areaLight.LightHeight);
            //float t = Mathf.InverseLerp(minArea, maxArea, area);  
            //t = Mathf.Pow(t, areaPower);

            //blurSize = Mathf.Lerp(minBlurSizeLink, maxBlurSizeLink, t);
            //blurIterations = Mathf.RoundToInt(Mathf.Lerp(minBlurIterations, maxBlurIterations, t));
            //downSample = Mathf.Lerp(minDownSample, maxDownSample, t);

            //minBlurSize = Mathf.Lerp(minMinBlurSize, maxMinBlurSize, t);
            //fadeStart = Mathf.Lerp(minFadeStart, maxFadeStart, t);
            //fadeEnd = Mathf.Lerp(minFadeEnd, maxFadeEnd, t);

            //intensityFadeStart = Mathf.Lerp(minIntensityFadeStart, maxIntensityFadeStart, t);
            //intensityFadeEnd = Mathf.Lerp(minIntensityFadeEnd, maxIntensityFadeEnd, t);

        }
        #endregion
    }
}

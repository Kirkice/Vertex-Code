using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Rendering;
using UnityEngine;
using CustomShadow02;

[ExecuteAlways]
public class ShadowControllerV2 : MonoBehaviour
{
    //  阴影球信息
    [SerializeField] public Vector3 spherePosition = Vector3.zero;
    [SerializeField] public float sphereRadius = 1.0f;
    [SerializeField] public bool drawGizmos = false;
    [SerializeField] public bool drawDebugGizmos = false;
    [SerializeField] public bool adaptiveBounds = false;
    
    //  阴影信息
    [SerializeField] public SoftShadowQuality softShadowQuality = SoftShadowQuality.Low;
    [SerializeField] [Range(0,2)]public float shadowBias = 0.01f;
    [SerializeField] [Range(0,3)]public float shadowNormalBias = 0.0f;
    [SerializeField] public Light targetLight;

    //  PCSS / DPCF 参数
    [SerializeField] public CustomShadowMode shadowMode = CustomShadowMode.PCF;
    [SerializeField] [Range(0.001f, 8f)]   public float pcssSoftness           = 0.5f;
    [SerializeField] [Range(1, 64)]        public int   pcssBlockerSampleCount  = 16;
    [SerializeField] [Range(1, 64)]        public int   dpcfBlockerSampleCount  = 12;
    [SerializeField] [Range(1, 64)]        public int   pcssFilterSampleCount   = 16;
    // DPCF 专用：偏移值
    [SerializeField] [Range(0f, 1f)]       public float dpcfPercentageOccludedBias = 0.8f;
    [SerializeField] [Range(0f, 0.1f)]     public float pcssMinFilterRadius     = 0.01f;
    [SerializeField] [Range(0.001f, 2f)]   public float pcssMaxFilterRadius     = 0.5f;

    // Directional PCSS 专用参数（仅平行光生效，语义对齐 HDRP）
    [SerializeField] [Range(0.001f, 0.2f)]  public float dirPcssRadial2DepthScale        = 0.0087f; // 半角正切，太阳约 0.27° -> tan ~= 0.00436，适当放大便于观察
    [SerializeField] [Range(0.01f, 20.0f)]  public float dirPcssMaxPenumbraSize          = 0.56f;   // 世界空间最大半影尺寸
    [SerializeField] [Range(0.01f, 20.0f)]  public float dirPcssMaxSamplingDistance      = 0.5f;    // 世界空间最大 z 采样距离
    [SerializeField] [Range(0.0f, 16.0f)]   public float dirPcssMinFilterSizeTexels      = 3.0f;    // 最小滤波半径（texels）
    [SerializeField] [Range(0.0f, 45.0f)]   public float dirPcssMinFilterMaxAngularDeg   = 16.0f;   // 达到最小滤波半径时允许的最大角直径
    [SerializeField] [Range(0.0f, 45.0f)]   public float dirPcssBlockerSearchAngularDeg  = 12.0f;   // blocker search 使用的角直径
    [SerializeField] [Range(0.1f, 4.0f)]    public float dirPcssBlockerClumpExponent     = 2.0f;    // HDRP UI 语义，shader 内会映射为 * 0.5

    private static int sumControllerIndex = 0;
    //  TODO Depth Slop Bias 暂时不需要
    //[SerializeField] public bool enableDepthSlopBias = false;
    //[SerializeField] [Range(0, 20)]public float depthSlopeBias = 0.0f;
    //[SerializeField] public float depthBiasClamp = 16.0f;
    
    private ShadowData shadowData;

    public Matrix4x4 ShadowViewMatrix       => shadowData.viewMatrix;
    public Matrix4x4 ShadowProjectionMatrix => shadowData.projectionMatrix;

    private CommandBuffer cmd;
    private CommandBuffer cmdDepth;          // binds _ShadowMapDepth after shadow map renders
    private MTAdditionalLightData m_additionalLightData;
    private CustomShadowMode m_prevShadowMode = CustomShadowMode.PCF;

    #if UNITY_ANDROID
    private Color shadowMapClearColor = Color.black;
    private float shadowMapClearDepth = 0.99999994f;
    private string gpuName;
    private string gpuVendor;
    #endif
    private void OnEnable()
    {
		//	关闭Cascaded 
        ShadowUtils.SetCascaedShadow(false);
        //  计数器 +1
        ShadowUtils.SetShadowCtrlCountAdd(ref sumControllerIndex);

        //  初始化command buffer
        cmd = new CommandBuffer();
        cmd.name = "CustomShadowPass";

        cmdDepth = new CommandBuffer();
        cmdDepth.name = "CustomShadowDepthCapture";
        cmdDepth.SetGlobalTexture("_ShadowMapDepth", UnityEngine.Rendering.BuiltinRenderTextureType.CurrentActive);

#if UNITY_ANDROID
        gpuName = SystemInfo.graphicsDeviceName.ToLower();
        gpuVendor = SystemInfo.graphicsDeviceVendor.ToLower();

        if (gpuName != null && gpuVendor != null)
        {
            if (gpuName.Contains("adreno") || gpuVendor.Contains("qualcomm"))
            {
                cmd.SetRenderTarget(BuiltinRenderTextureType.CurrentActive);
                cmd.ClearRenderTarget(true, false, shadowMapClearColor, shadowMapClearDepth);
            }
        }
#endif

        InitController();
    }
    
    private void Update()
    {
        if (CheckController() == false)
            return;
        
        //  更新灯光矩阵以及cbuffer
        targetLight.shadowBias = shadowBias;
        targetLight.shadowNormalBias = shadowNormalBias;
        float scale = this.transform.lossyScale.x;
        Vector3 worldSpherePos = spherePosition * scale + this.transform.position;
        float   worldRadius    = sphereRadius * scale;

        bool isSpotOnlyShadow = m_additionalLightData != null &&
                                (m_additionalLightData.CurrentLightType == MTLightType.SpotOnlyShadow ||
                                 m_additionalLightData.CurrentLightType == MTLightType.SpotVirtual);
        if (isSpotOnlyShadow)
            ShadowUtils.ExtractSpotLightMatrix(ref shadowData, targetLight, worldSpherePos, worldRadius,
                m_additionalLightData.SpotAngle, m_additionalLightData.Range);
        else if (targetLight.type == LightType.Directional)
            ShadowUtils.ExtractDirectionalLightMatrix(ref shadowData, targetLight, worldSpherePos, worldRadius);
        
        // 切换 PCSS keyword（仅模式变化时调用，避免每帧触发）
        if (shadowMode != m_prevShadowMode)
        {
            m_prevShadowMode = shadowMode;
            ShadowUtils.SetPCSSKeyword(shadowMode != CustomShadowMode.PCF);
        }

        // 计算透视光源深度线性化参数
        Vector4 zBufferParams = Vector4.zero;
        if (isSpotOnlyShadow)
            zBufferParams = ShadowUtils.ComputeZBufferParams(0.15f, m_additionalLightData.Range);

        // DPCF reuses blocker search results (no second PCF pass), so fewer taps suffice
        int effectiveBlockerCount = (shadowMode == CustomShadowMode.DPCF)
            ? dpcfBlockerSampleCount
            : pcssBlockerSampleCount;

        ShadowUtils.SetupShadowCasterConstantBuffer(cmd, targetLight, shadowData, softShadowQuality,
            shadowMode, pcssSoftness, effectiveBlockerCount, pcssFilterSampleCount,
            pcssMinFilterRadius, pcssMaxFilterRadius, isSpotOnlyShadow, zBufferParams,
            dirPcssRadial2DepthScale, dirPcssMaxPenumbraSize,
            dirPcssMaxSamplingDistance, dirPcssMinFilterSizeTexels,
            dirPcssMinFilterMaxAngularDeg, dirPcssBlockerSearchAngularDeg,
            dirPcssBlockerClumpExponent, dpcfPercentageOccludedBias);
    }

    private void OnDisable()
    {
        //  计数器 -1
        ShadowUtils.SetShadowCtrlCountSub(ref sumControllerIndex);
        Clear();
    }

    private void OnDestroy()
    {
        cmd?.Dispose();
        cmd = null;
        cmdDepth?.Dispose();
        cmdDepth = null;
    }

    private void OnDrawGizmos()
    {
        if (drawGizmos)
        {
            Gizmos.color = new Color(0.2f, 1, 0.2f, 0.7f);

            float scale = this.transform.lossyScale.x;
            Gizmos.DrawSphere(spherePosition * scale + this.transform.position, sphereRadius * scale);  
            
            if(targetLight != null)
            {
                //  Draw
                Vector3[] farVecArr = ShadowUtils.GetOrthoCameraVector(2 * sphereRadius * scale, spherePosition * scale + this.transform.position - targetLight.transform.forward * sphereRadius * scale,
                    targetLight.transform.forward, targetLight.transform.right, targetLight.transform.up, sphereRadius * scale);

                Vector3[] nearVecArr = ShadowUtils.GetOrthoCameraVector(0, spherePosition * scale + this.transform.position - targetLight.transform.forward * sphereRadius * scale,
                    targetLight.transform.forward, targetLight.transform.right, targetLight.transform.up, sphereRadius * scale);

                Gizmos.color = Color.blue;

                // Draw near rectangle
                Gizmos.DrawLine(nearVecArr[0], nearVecArr[1]);
                Gizmos.DrawLine(nearVecArr[1], nearVecArr[2]);
                Gizmos.DrawLine(nearVecArr[2], nearVecArr[3]);
                Gizmos.DrawLine(nearVecArr[3], nearVecArr[0]);

                // Draw far rectangle
                Gizmos.DrawLine(farVecArr[0], farVecArr[1]);
                Gizmos.DrawLine(farVecArr[1], farVecArr[2]);
                Gizmos.DrawLine(farVecArr[2], farVecArr[3]);
                Gizmos.DrawLine(farVecArr[3], farVecArr[0]);


                // Draw lines connecting near and far clip planes
                Gizmos.DrawLine(nearVecArr[0], farVecArr[0]);
                Gizmos.DrawLine(nearVecArr[1], farVecArr[1]);
                Gizmos.DrawLine(nearVecArr[2], farVecArr[2]);
                Gizmos.DrawLine(nearVecArr[3], farVecArr[3]);
            }
        }
    }

    private void OnDrawGizmosSelected()
    {
        if (!drawDebugGizmos || targetLight == null)
            return;

        if (!TryGetSpotLightSettings(out float spotAngle, out float far))
            return;

        float scale = this.transform.lossyScale.x;
        Vector3 spherePos = spherePosition * scale + this.transform.position;
        float radius = sphereRadius * scale;

        Vector3 lightForward = targetLight.transform.forward;
        Vector3 lightUp = Vector3.up;
        if (Mathf.Abs(Vector3.Dot(lightUp, lightForward)) > (1f - 1e-2f))
            lightUp = Vector3.forward;

        Matrix4x4 viewMatrix = Matrix4x4.LookAt(targetLight.transform.position,
            targetLight.transform.position + lightForward, lightUp).inverse;
        FlipZForGizmos(ref viewMatrix);
        FlipYForGizmos(ref viewMatrix);

        Vector3 centerView = viewMatrix.MultiplyPoint(spherePos);
        const float near = 0.15f;
        float dist = CalculateDistanceToFrustumForGizmos(centerView, spotAngle, near, far);
        float t = Mathf.Clamp01(dist / radius);
        float rXY = radius * (1.0f - t * t);

        float z = centerView.z;
        float tanHalf = Mathf.Tan(spotAngle * 0.5f * Mathf.Deg2Rad);
        float halfWidth = -z * tanHalf;
        float cx = centerView.x;
        float cy = centerView.y;

        float xMin = float.MaxValue, xMax = float.MinValue;
        float yMin = float.MaxValue, yMax = float.MinValue;
        CalculateCircleSquareAabb(cx, cy, rXY, halfWidth, ref xMin, ref xMax, ref yMin, ref yMax);

        Matrix4x4 invViewMatrix = viewMatrix.inverse;

        Vector3 circleCenter = invViewMatrix.MultiplyPoint(centerView);
        Gizmos.color = new Color(0f, 1f, 1f, 0.6f);
        DrawCircleGizmo(circleCenter, targetLight.transform.forward, rXY, 32);

        Gizmos.color = new Color(1f, 1f, 0f, 0.5f);
        Vector3 sq0 = invViewMatrix.MultiplyPoint(new Vector3(-halfWidth, -halfWidth, z));
        Vector3 sq1 = invViewMatrix.MultiplyPoint(new Vector3( halfWidth, -halfWidth, z));
        Vector3 sq2 = invViewMatrix.MultiplyPoint(new Vector3( halfWidth,  halfWidth, z));
        Vector3 sq3 = invViewMatrix.MultiplyPoint(new Vector3(-halfWidth,  halfWidth, z));
        Gizmos.DrawLine(sq0, sq1);
        Gizmos.DrawLine(sq1, sq2);
        Gizmos.DrawLine(sq2, sq3);
        Gizmos.DrawLine(sq3, sq0);

        if (xMin >= xMax || yMin >= yMax)
            return;

        Vector3 aabb0 = invViewMatrix.MultiplyPoint(new Vector3(xMin, yMin, z));
        Vector3 aabb1 = invViewMatrix.MultiplyPoint(new Vector3(xMax, yMin, z));
        Vector3 aabb2 = invViewMatrix.MultiplyPoint(new Vector3(xMax, yMax, z));
        Vector3 aabb3 = invViewMatrix.MultiplyPoint(new Vector3(xMin, yMax, z));

        Gizmos.color = new Color(1f, 0f, 1f, 1f);
        for (int i = 0; i < 3; i++)
        {
            Gizmos.DrawLine(aabb0, aabb1);
            Gizmos.DrawLine(aabb1, aabb2);
            Gizmos.DrawLine(aabb2, aabb3);
            Gizmos.DrawLine(aabb3, aabb0);
        }

        Gizmos.color = new Color(1f, 0f, 0f, 0.6f);
        Gizmos.DrawLine(aabb0, aabb2);
        Gizmos.DrawLine(aabb1, aabb3);
    }

    private bool TryGetSpotLightSettings(out float spotAngle, out float far)
    {
        spotAngle = 0f;
        far = 0f;

        if (targetLight == null)
            return false;

        MTAdditionalLightData additionalLightData = targetLight.GetComponent<MTAdditionalLightData>();
        bool isSpotOnlyShadow = additionalLightData != null &&
                                (additionalLightData.CurrentLightType == MTLightType.SpotOnlyShadow ||
                                 additionalLightData.CurrentLightType == MTLightType.SpotVirtual);
        bool isSpot = targetLight.type == LightType.Spot || isSpotOnlyShadow;
        if (!isSpot)
            return false;

        spotAngle = isSpotOnlyShadow ? additionalLightData.SpotAngle : targetLight.spotAngle;
        far = isSpotOnlyShadow ? additionalLightData.Range : targetLight.range;
        return spotAngle > 0f && far > 0f;
    }

    private static void FlipZForGizmos(ref Matrix4x4 matrix)
    {
        matrix.m20 *= -1;
        matrix.m21 *= -1;
        matrix.m22 *= -1;
        matrix.m23 *= -1;
    }

    private static void FlipYForGizmos(ref Matrix4x4 matrix)
    {
        if (SystemInfo.graphicsDeviceType == GraphicsDeviceType.Direct3D11 ||
            SystemInfo.graphicsDeviceType == GraphicsDeviceType.Direct3D12 ||
            SystemInfo.graphicsDeviceType == GraphicsDeviceType.Vulkan ||
            SystemInfo.graphicsDeviceType == GraphicsDeviceType.Metal)
        {
            matrix.m10 *= -1;
            matrix.m11 *= -1;
            matrix.m12 *= -1;
            matrix.m13 *= -1;
        }
    }

    private static float CalculateDistanceToFrustumForGizmos(Vector3 center, float spotAngleDeg, float near, float far)
    {
        float tanHalf = Mathf.Tan(spotAngleDeg * 0.5f * Mathf.Deg2Rad);
        float z = center.z;

        float dNear = near - z;
        float dFar = z - far;
        float halfWidth = -z * tanHalf;
        float dLeft = halfWidth + center.x;
        float dRight = halfWidth - center.x;
        float dBottom = halfWidth + center.y;
        float dTop = halfWidth - center.y;

        float d = Mathf.Min(dNear, Mathf.Min(dFar, Mathf.Min(dLeft, Mathf.Min(dRight, Mathf.Min(dBottom, dTop)))));
        return Mathf.Max(0f, d);
    }

    private static void CalculateCircleSquareAabb(float cx, float cy, float radius, float halfWidth,
        ref float xMin, ref float xMax, ref float yMin, ref float yMax)
    {
        float dLeft = Mathf.Abs(cx + halfWidth);
        if (dLeft < radius)
        {
            float dy = Mathf.Sqrt(radius * radius - dLeft * dLeft);
            float y1 = cy - dy, y2 = cy + dy;
            if (y1 >= -halfWidth && y1 <= halfWidth) { xMin = Mathf.Min(xMin, -halfWidth); yMin = Mathf.Min(yMin, y1); yMax = Mathf.Max(yMax, y1); }
            if (y2 >= -halfWidth && y2 <= halfWidth) { xMin = Mathf.Min(xMin, -halfWidth); yMin = Mathf.Min(yMin, y2); yMax = Mathf.Max(yMax, y2); }
        }

        float dRight = Mathf.Abs(cx - halfWidth);
        if (dRight < radius)
        {
            float dy = Mathf.Sqrt(radius * radius - dRight * dRight);
            float y1 = cy - dy, y2 = cy + dy;
            if (y1 >= -halfWidth && y1 <= halfWidth) { xMax = Mathf.Max(xMax, halfWidth); yMin = Mathf.Min(yMin, y1); yMax = Mathf.Max(yMax, y1); }
            if (y2 >= -halfWidth && y2 <= halfWidth) { xMax = Mathf.Max(xMax, halfWidth); yMin = Mathf.Min(yMin, y2); yMax = Mathf.Max(yMax, y2); }
        }

        float dBottom = Mathf.Abs(cy + halfWidth);
        if (dBottom < radius)
        {
            float dx = Mathf.Sqrt(radius * radius - dBottom * dBottom);
            float x1 = cx - dx, x2 = cx + dx;
            if (x1 >= -halfWidth && x1 <= halfWidth) { yMin = Mathf.Min(yMin, -halfWidth); xMin = Mathf.Min(xMin, x1); xMax = Mathf.Max(xMax, x1); }
            if (x2 >= -halfWidth && x2 <= halfWidth) { yMin = Mathf.Min(yMin, -halfWidth); xMin = Mathf.Min(xMin, x2); xMax = Mathf.Max(xMax, x2); }
        }

        float dTop = Mathf.Abs(cy - halfWidth);
        if (dTop < radius)
        {
            float dx = Mathf.Sqrt(radius * radius - dTop * dTop);
            float x1 = cx - dx, x2 = cx + dx;
            if (x1 >= -halfWidth && x1 <= halfWidth) { yMax = Mathf.Max(yMax, halfWidth); xMin = Mathf.Min(xMin, x1); xMax = Mathf.Max(xMax, x1); }
            if (x2 >= -halfWidth && x2 <= halfWidth) { yMax = Mathf.Max(yMax, halfWidth); xMin = Mathf.Min(xMin, x2); xMax = Mathf.Max(xMax, x2); }
        }

        Vector2[] squareCorners = { new Vector2(-halfWidth, -halfWidth), new Vector2(halfWidth, -halfWidth), new Vector2(halfWidth, halfWidth), new Vector2(-halfWidth, halfWidth) };
        foreach (var corner in squareCorners)
        {
            if ((corner.x - cx) * (corner.x - cx) + (corner.y - cy) * (corner.y - cy) <= radius * radius)
            {
                xMin = Mathf.Min(xMin, corner.x);
                xMax = Mathf.Max(xMax, corner.x);
                yMin = Mathf.Min(yMin, corner.y);
                yMax = Mathf.Max(yMax, corner.y);
            }
        }

        if (cx - radius >= -halfWidth && cx - radius <= halfWidth && cy >= -halfWidth && cy <= halfWidth) xMin = Mathf.Min(xMin, cx - radius);
        if (cx + radius >= -halfWidth && cx + radius <= halfWidth && cy >= -halfWidth && cy <= halfWidth) xMax = Mathf.Max(xMax, cx + radius);
        if (cy - radius >= -halfWidth && cy - radius <= halfWidth && cx >= -halfWidth && cx <= halfWidth) yMin = Mathf.Min(yMin, cy - radius);
        if (cy + radius >= -halfWidth && cy + radius <= halfWidth && cx >= -halfWidth && cx <= halfWidth) yMax = Mathf.Max(yMax, cy + radius);
    }

    private static void DrawCircleGizmo(Vector3 center, Vector3 normal, float radius, int segments)
    {
        if (segments < 3)
            segments = 3;

        Vector3 forward = normal.normalized;
        Vector3 right = Vector3.Cross(forward, Mathf.Abs(forward.y) > 0.9f ? Vector3.right : Vector3.up).normalized;
        Vector3 up = Vector3.Cross(right, forward).normalized;

        Vector3 prevPoint = center + right * radius;
        for (int i = 1; i <= segments; i++)
        {
            float angle = (float)i / segments * 2f * Mathf.PI;
            Vector3 nextPoint = center + (right * Mathf.Cos(angle) + up * Mathf.Sin(angle)) * radius;
            Gizmos.DrawLine(prevPoint, nextPoint);
            prevPoint = nextPoint;
        }
    }
    //ShadowController

    #region functions
    /// <summary>
    /// 设置目标灯光
    /// </summary>
    public void SetTargetLight(Light light,bool defaultCullMask = true)
    {
        targetLight = light;

        if(cmd == null)
        {
            //  初始化command buffer
            cmd = new CommandBuffer();
            cmd.name = "CustomShadowPass";
#if UNITY_ANDROID
        gpuName = SystemInfo.graphicsDeviceName.ToLower();
        gpuVendor = SystemInfo.graphicsDeviceVendor.ToLower();

        if (gpuName != null && gpuVendor != null)
        {
            if (gpuName.Contains("adreno") || gpuVendor.Contains("qualcomm"))
            {
                cmd.SetRenderTarget(BuiltinRenderTextureType.CurrentActive);
                cmd.ClearRenderTarget(true, false, shadowMapClearColor, shadowMapClearDepth);
            }
        }
#endif
        }

        if (cmdDepth == null)
        {
            cmdDepth = new CommandBuffer();
            cmdDepth.name = "CustomShadowDepthCapture";
            cmdDepth.SetGlobalTexture("_ShadowMapDepth", UnityEngine.Rendering.BuiltinRenderTextureType.CurrentActive);
        }

        InitController(defaultCullMask);
    }

    public void InitController(bool defaultCullMask = true)
    {
        if (targetLight == null || cmd == null || this.gameObject.active == false)
            return;

        m_additionalLightData = targetLight.GetComponent<MTAdditionalLightData>();

        //  开启Unity 阴影
        targetLight.shadows = LightShadows.Hard;
        if (defaultCullMask)
        {
            targetLight.cullingMask = ~(1 << LayerMask.NameToLayer("Solider"));
        }

        QualitySettings.shadowDistance = 30.0f;

        //  初始化 shadow data
        shadowData.Init();
        
        //  初始化光源
        if(ShadowUtils.InitLight(ref targetLight, ref shadowData, ref cmd, cmdDepth) == false)
            return;

        //  是否需要自适应包围盒
        if(adaptiveBounds)
            SetAdaptiveShadowSphere();

        //  PCSS keyword 初始状态
        m_prevShadowMode = shadowMode;
        ShadowUtils.SetPCSSKeyword(shadowMode != CustomShadowMode.PCF);

        //  检查是否初始化成功
        if (CheckController() == false)
        {
#if UNITY_EDITOR
            Debug.LogError("初始化失败！请检查是否存在空组件！");
#endif
            if(sumControllerIndex <= 0)
                ShadowUtils.SetAdditionalLightKeyWords(false);

        }   //  设置 Shader 支持自定义阴影
        else
        {
            ShadowUtils.SetAdditionalLightKeyWords(true && sumControllerIndex > 0);
        }
    }
    
    /// <summary>
    /// 设置自适应阴影球
    /// </summary>
    public void SetAdaptiveShadowSphere()
    {
        ShadowUtils.SetAdaptiveShadowSphere(ref spherePosition,ref sphereRadius, this.transform.position);
    }
    
    /// <summary>
    /// 检查Controller初始化
    /// </summary>
    /// <returns></returns>
    private bool CheckController()
    {
        if (targetLight == null)
            return false;

        if (cmd == null)
            return false;

        return true;
    }

    private void Clear()
    {
        if (sumControllerIndex <= 0)
            ShadowUtils.SetAdditionalLightKeyWords(false);

        ShadowUtils.SetPCSSKeyword(false);

        //  cmd 释放
        cmd?.Clear();
        cmdDepth?.Clear();
        
        //  阴影数据清理
        shadowData.Clear();
        
        //  灯光释放
        if (targetLight == null) 
            return;

        if(targetLight.commandBufferCount > 0)
            targetLight.RemoveAllCommandBuffers();

        targetLight.shadowResolution = LightShadowResolution.FromQualitySettings;
        targetLight.shadowCustomResolution = 0;
    }
    #endregion
}

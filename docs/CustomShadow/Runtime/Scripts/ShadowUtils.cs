using System.Collections;
using System.Collections.Generic;
#if UNITY_EDITOR
using UnityEditor;
#endif
using UnityEngine;
using UnityEngine.Rendering;

namespace CustomShadow02
{
    public enum CustomShadowMode
    {
        PCF  = 0,
        DPCF = 1,
        PCSS = 2,
    }

    public enum SoftShadowQuality
    {
        /// <summary>
        /// Low quality soft shadows. Recommended for mobile. 4 PCF sample filtering.
        /// </summary>
        Low = 1,

        /// <summary>
        /// Medium quality soft shadows. The default. 5x5 tent filtering.
        /// </summary>
        Medium = 2,

        /// <summary>
        /// High quality soft shadows. Low performance due to high sample count. 7x7 tent filtering.
        /// </summary>
        High = 3,
    }

    /// <summary>
    /// Struct container for shadow data.
    /// </summary>
    public struct ShadowData
    {
        /// <summary>
        /// The view matrix.
        /// </summary>
        public Matrix4x4 viewMatrix;

        /// <summary>
        /// The projection matrix.
        /// </summary>
        public Matrix4x4 projectionMatrix;

        public int shadowMapResolution;

        /// <summary>
        /// Clears and resets the data.
        /// </summary>
        public void Clear()
        {
            viewMatrix = Matrix4x4.identity;
            projectionMatrix = Matrix4x4.identity;
            shadowMapResolution = ShadowUtils.ShadowMapResolution;
        }

        public void Init()
        {
            viewMatrix = new Matrix4x4();
            projectionMatrix = new Matrix4x4();
            shadowMapResolution = ShadowUtils.ShadowMapResolution;
        }
    }

    public class ShadowUtils
    {
        public const int ShadowMapResolution = 1024;

        
        public static float Dot3(Vector3 a, Vector3 b)
        {
            return a.x * b.x + a.y * b.y + a.z * b.z;
        }

        public static void FlipZ(ref Matrix4x4 m)
        {
            m.m20 *= -1;
            m.m21 *= -1;
            m.m22 *= -1;
            m.m23 *= -1;
        }

        public static void FlipY(ref Matrix4x4 m)
        {
            if (SystemInfo.graphicsDeviceType == GraphicsDeviceType.Direct3D11 ||
                SystemInfo.graphicsDeviceType == GraphicsDeviceType.Direct3D12 ||
                SystemInfo.graphicsDeviceType == GraphicsDeviceType.Vulkan ||
                SystemInfo.graphicsDeviceType == GraphicsDeviceType.Metal)
            {
                m.m10 *= -1;
                m.m11 *= -1;
                m.m12 *= -1;
                m.m13 *= -1;
            }
        }

        /// <summary>
        /// CalculateRoundingMatrix
        /// </summary>
        /// <param name="projMat"></param>
        /// <param name="viewMat"></param>
        /// <param name="shadowMapSize"></param>
        /// <returns></returns>
        public static Matrix4x4 CalculateRoundingMatrix(Matrix4x4 projMat, Matrix4x4 viewMat, Vector2 shadowMapSize)
        {
            //  得到 vp 矩阵
            Matrix4x4 glMat = GL.GetGPUProjectionMatrix(Matrix4x4.identity, true);
            Matrix4x4 viewProjMat = (glMat * projMat) * viewMat;

            //  将原点转到投影空间
            Vector4 somePoint = new Vector4(0, 0, 0, 1);
            somePoint = viewProjMat * somePoint;

            //  计算原点在shadowmap中的坐标
            Vector2 shadowUv = new Vector2(somePoint.x * 0.5f, somePoint.y * 0.5f);
            Vector2 shadowSt = new Vector2(shadowUv.x * shadowMapSize.x, shadowUv.y * shadowMapSize.y);

            //  将影子贴图中的采样点坐标取整
            Vector2 roundedSt = new Vector2(Mathf.Round(shadowSt.x), Mathf.Round(shadowSt.y));
            //  得到偏移值
            Vector2 stOffset = roundedSt - shadowSt;
            Vector2 uvOffset = new Vector2(stOffset.x * 2 / shadowMapSize.x, stOffset.y * 2 / shadowMapSize.y);
            //  构造平移矩阵用于修正
            Matrix4x4 roundMatrix = Matrix4x4.Translate(new Vector3(uvOffset.x, uvOffset.y * glMat.m11, 0));

            return roundMatrix;
        }
        
        public static void ExtractDirectionalLightMatrix(ref ShadowData shadowData, Light shadowLight,
            Vector3 spherePos, float sphereRadius)
        {
            //  根据灯光设置分配阴影贴图大小
            shadowData.shadowMapResolution = ShadowMapResolution;
            shadowLight.shadowCustomResolution = ShadowMapResolution;

            Vector3 lightForwardDir = shadowLight.transform.forward;
            Vector3 lightUpDir = new Vector3(0, 1, 0);
            if (Mathf.Abs(Dot3(lightUpDir, lightForwardDir)) > (1 - 1e-2))
                lightUpDir = new Vector3(0, 0, 1);

            //  平行光 正交投影
            if (SystemInfo.graphicsDeviceType == GraphicsDeviceType.Direct3D11 ||
                SystemInfo.graphicsDeviceType == GraphicsDeviceType.Direct3D12 ||
                SystemInfo.graphicsDeviceType == GraphicsDeviceType.Vulkan ||
                SystemInfo.graphicsDeviceType == GraphicsDeviceType.Metal)
            {
                shadowData.projectionMatrix = CreateDXOrthoMatrix(-sphereRadius, sphereRadius, -sphereRadius, sphereRadius, -15, 15);
                shadowData.viewMatrix =
                    Matrix4x4.LookAt(spherePos, spherePos + lightForwardDir, lightUpDir).inverse; 
            }
            else
            {
                shadowData.projectionMatrix = CreateOpenGLOrthoMatrix(-sphereRadius, sphereRadius, -sphereRadius, sphereRadius, 0, 2 * 15);
                Vector3 shadowCameraPos = spherePos - lightForwardDir * sphereRadius;
                shadowData.viewMatrix = Matrix4x4.LookAt(shadowCameraPos, shadowCameraPos + lightForwardDir, lightUpDir).inverse;
            }
            
            //  Z轴翻转
            FlipZ(ref shadowData.viewMatrix);
            FlipY(ref shadowData.viewMatrix);

            //  修正阴影移动的闪烁
            Matrix4x4 roundingMat = CalculateRoundingMatrix(shadowData.projectionMatrix, shadowData.viewMatrix,
                new Vector2(shadowData.shadowMapResolution, shadowData.shadowMapResolution));
            shadowData.projectionMatrix = roundingMat * shadowData.projectionMatrix;
        }

        // spotAngle / far 为 0 时自动从 shadowLight 读取，SpotOnlyShadow 时传入 MTAdditionalLightData 的值
        public static void ExtractSpotLightMatrix(ref ShadowData shadowData, Light shadowLight,
            Vector3 spherePos, float sphereRadius, float spotAngle = 0f, float far = 15.0f)
        {
            shadowData.shadowMapResolution = ShadowMapResolution;
            shadowLight.shadowCustomResolution = ShadowMapResolution;

            if (spotAngle <= 0f) spotAngle = shadowLight.spotAngle;

            Vector3 lightForward = shadowLight.transform.forward;
            Vector3 lightUp = new Vector3(0, 1, 0);
            if (Mathf.Abs(Dot3(lightUp, lightForward)) > (1 - 1e-2))
                lightUp = new Vector3(0, 0, 1);

            // View matrix from light origin (not sphere center)
            Vector3 lightPos = shadowLight.transform.position;
            shadowData.viewMatrix = Matrix4x4.LookAt(lightPos, lightPos + lightForward, lightUp).inverse;
            FlipZ(ref shadowData.viewMatrix);
            FlipY(ref shadowData.viewMatrix);

            const float near = 0.15f;
            shadowData.projectionMatrix = Matrix4x4.Perspective(spotAngle, 1.0f, near, far);
            // Matrix4x4.Perspective 是 OpenGL 约定（z 输出 [-1,1]）。在 DX/VK/Metal 上必须做 Z range
            // 与 reverse-Z 的平台原生转换，否则 shader 直接用 customShadowProjM * customShadowViewM
            // 作为 ClipPos 时，深度会被裁掉或方向反掉（典型表现：Vulkan 下深度看起来反了）。
            // renderIntoTexture=false：仅做 Z 转换，不做 Y 翻转（Y 翻转已由上方 FlipY(view) 承担）。
            // GLES 上此调用相当于 no-op，保持原行为。
            shadowData.projectionMatrix = GL.GetGPUProjectionMatrix(shadowData.projectionMatrix, false);

            // === Crop matrix: maximize shadow map texel density within bounding sphere ===

            // 1. Sphere center in View Space
            Vector3 centerView = shadowData.viewMatrix.MultiplyPoint(spherePos);

            // 2. Effective XY radius — shrinks as sphere exits the frustum (quadratic falloff)
            float dist  = CalculateDistanceToFrustum(centerView, spotAngle, near, far);
            float t     = Mathf.Clamp01(dist / sphereRadius);
            float r_xy  = sphereRadius * (1.0f - t * t);

            // 3. At sphere's depth, find AABB of 2D circle ∩ frustum cross-section square
            float z       = centerView.z;
            float tanHalf = Mathf.Tan(spotAngle * 0.5f * Mathf.Deg2Rad);
            float hw      = -z * tanHalf;   // frustum half-width at depth z (z is negative in view space)
            float cx      = centerView.x;
            float cy      = centerView.y;

            float xMin = float.MaxValue, xMax = float.MinValue;
            float yMin = float.MaxValue, yMax = float.MinValue;

            // Circle vs left edge (x = -hw)
            float dLeft = Mathf.Abs(cx + hw);
            if (dLeft < r_xy)
            {
                float dy = Mathf.Sqrt(r_xy * r_xy - dLeft * dLeft);
                float y1 = cy - dy, y2 = cy + dy;
                if (y1 >= -hw && y1 <= hw) { xMin = Mathf.Min(xMin, -hw); yMin = Mathf.Min(yMin, y1); yMax = Mathf.Max(yMax, y1); }
                if (y2 >= -hw && y2 <= hw) { xMin = Mathf.Min(xMin, -hw); yMin = Mathf.Min(yMin, y2); yMax = Mathf.Max(yMax, y2); }
            }
            // Circle vs right edge (x = hw)
            float dRight = Mathf.Abs(cx - hw);
            if (dRight < r_xy)
            {
                float dy = Mathf.Sqrt(r_xy * r_xy - dRight * dRight);
                float y1 = cy - dy, y2 = cy + dy;
                if (y1 >= -hw && y1 <= hw) { xMax = Mathf.Max(xMax, hw); yMin = Mathf.Min(yMin, y1); yMax = Mathf.Max(yMax, y1); }
                if (y2 >= -hw && y2 <= hw) { xMax = Mathf.Max(xMax, hw); yMin = Mathf.Min(yMin, y2); yMax = Mathf.Max(yMax, y2); }
            }
            // Circle vs bottom edge (y = -hw)
            float dBottom = Mathf.Abs(cy + hw);
            if (dBottom < r_xy)
            {
                float dx = Mathf.Sqrt(r_xy * r_xy - dBottom * dBottom);
                float x1 = cx - dx, x2 = cx + dx;
                if (x1 >= -hw && x1 <= hw) { yMin = Mathf.Min(yMin, -hw); xMin = Mathf.Min(xMin, x1); xMax = Mathf.Max(xMax, x1); }
                if (x2 >= -hw && x2 <= hw) { yMin = Mathf.Min(yMin, -hw); xMin = Mathf.Min(xMin, x2); xMax = Mathf.Max(xMax, x2); }
            }
            // Circle vs top edge (y = hw)
            float dTop = Mathf.Abs(cy - hw);
            if (dTop < r_xy)
            {
                float dx = Mathf.Sqrt(r_xy * r_xy - dTop * dTop);
                float x1 = cx - dx, x2 = cx + dx;
                if (x1 >= -hw && x1 <= hw) { yMax = Mathf.Max(yMax, hw); xMin = Mathf.Min(xMin, x1); xMax = Mathf.Max(xMax, x1); }
                if (x2 >= -hw && x2 <= hw) { yMax = Mathf.Max(yMax, hw); xMin = Mathf.Min(xMin, x2); xMax = Mathf.Max(xMax, x2); }
            }
            // Square corners inside circle
            Vector2[] squareCorners = { new Vector2(-hw,-hw), new Vector2(hw,-hw), new Vector2(hw,hw), new Vector2(-hw,hw) };
            foreach (var c in squareCorners)
            {
                if ((c.x-cx)*(c.x-cx) + (c.y-cy)*(c.y-cy) <= r_xy*r_xy)
                { xMin=Mathf.Min(xMin,c.x); xMax=Mathf.Max(xMax,c.x); yMin=Mathf.Min(yMin,c.y); yMax=Mathf.Max(yMax,c.y); }
            }
            // Circle extremes inside square
            if (cx-r_xy >= -hw && cx-r_xy <= hw && cy >= -hw && cy <= hw) xMin = Mathf.Min(xMin, cx-r_xy);
            if (cx+r_xy >= -hw && cx+r_xy <= hw && cy >= -hw && cy <= hw) xMax = Mathf.Max(xMax, cx+r_xy);
            if (cy-r_xy >= -hw && cy-r_xy <= hw && cx >= -hw && cx <= hw) yMin = Mathf.Min(yMin, cy-r_xy);
            if (cy+r_xy >= -hw && cy+r_xy <= hw && cx >= -hw && cx <= hw) yMax = Mathf.Max(yMax, cy+r_xy);

            // No intersection: fall back to plain perspective + rounding
            if (xMin >= xMax || yMin >= yMax)
            {
                Matrix4x4 rm = CalculateRoundingMatrix(shadowData.projectionMatrix, shadowData.viewMatrix,
                    new Vector2(shadowData.shadowMapResolution, shadowData.shadowMapResolution));
                shadowData.projectionMatrix = rm * shadowData.projectionMatrix;
                return;
            }

            // 4. Project AABB corners to NDC
            Vector3[] viewCorners = { new Vector3(xMin,yMin,z), new Vector3(xMin,yMax,z), new Vector3(xMax,yMin,z), new Vector3(xMax,yMax,z) };
            float ndcMinX=float.MaxValue, ndcMaxX=float.MinValue, ndcMinY=float.MaxValue, ndcMaxY=float.MinValue;
            foreach (var vc in viewCorners)
            {
                Vector4 clip = shadowData.projectionMatrix * new Vector4(vc.x, vc.y, vc.z, 1f);
                if (clip.w > 0.0001f)
                {
                    float nx = clip.x / clip.w, ny = clip.y / clip.w;
                    ndcMinX=Mathf.Min(ndcMinX,nx); ndcMaxX=Mathf.Max(ndcMaxX,nx);
                    ndcMinY=Mathf.Min(ndcMinY,ny); ndcMaxY=Mathf.Max(ndcMaxY,ny);
                }
            }

            // 5. Add margin and clamp
            const float margin = 0.02f;
            float rngX = ndcMaxX - ndcMinX, rngY = ndcMaxY - ndcMinY;
            ndcMinX = Mathf.Max(ndcMinX - rngX*margin, -2f); ndcMaxX = Mathf.Min(ndcMaxX + rngX*margin, 2f);
            ndcMinY = Mathf.Max(ndcMinY - rngY*margin, -2f); ndcMaxY = Mathf.Min(ndcMaxY + rngY*margin, 2f);

            // 6. Build Crop matrix (zoom NDC into the tight AABB)
            float sx = 2f/(ndcMaxX-ndcMinX), sy = 2f/(ndcMaxY-ndcMinY);
            float ox = -(ndcMaxX+ndcMinX)/(ndcMaxX-ndcMinX), oy = -(ndcMaxY+ndcMinY)/(ndcMaxY-ndcMinY);
            Matrix4x4 crop = Matrix4x4.identity;
            crop.m00 = sx;   crop.m11 = -sy;
            crop.m03 = ox;   crop.m13 = -oy;
            shadowData.projectionMatrix = crop * shadowData.projectionMatrix;

            // 7. Rounding matrix (shadow stabilization)
            Matrix4x4 roundingMat = CalculateRoundingMatrix(shadowData.projectionMatrix, shadowData.viewMatrix,
                new Vector2(shadowData.shadowMapResolution, shadowData.shadowMapResolution));
            shadowData.projectionMatrix = roundingMat * shadowData.projectionMatrix;
        }

        // 计算球心到 View Space Frustum 边界的距离；在内部返回 0
        private static float CalculateDistanceToFrustum(Vector3 center, float spotAngleDeg, float near, float far)
        {
            float tanHalf = Mathf.Tan(spotAngleDeg * 0.5f * Mathf.Deg2Rad);
            float z = center.z;   // negative in view space

            float dNear   = near - z;
            float dFar    = z - far;
            float hw      = -z * tanHalf;
            float dLeft   = hw + center.x;
            float dRight  = hw - center.x;
            float dBottom = hw + center.y;
            float dTop    = hw - center.y;

            float d = Mathf.Min(dNear, Mathf.Min(dFar, Mathf.Min(dLeft, Mathf.Min(dRight, Mathf.Min(dBottom, dTop)))));
            return Mathf.Max(0f, d);
        }
        
        /// <summary>
        /// Calculates the depth and normal bias from a light.
        /// </summary>
        /// <param name="shadowLight"></param>
        /// <param name="shadowLightIndex"></param>
        /// <param name="shadowData"></param>
        /// <param name="lightProjectionMatrix"></param>
        /// <param name="shadowResolution"></param>
        /// <returns>The depth and normal bias from a visible light.</returns>
        public static Vector4 URPGetShadowBias(
            Light shadowLight,
            ShadowData data,
            SoftShadowQuality softShadowQuality
        )
        {
            //  LightType: Directional
            float frustumSize = 2.0f / data.projectionMatrix.m00;

            // depth and normal bias scale is in shadowmap texel size in world space
            float texelSize = frustumSize / data.shadowMapResolution;

            float depthBias = -shadowLight.shadowBias * texelSize;
            float normalBias = -shadowLight.shadowNormalBias * texelSize;

            if (shadowLight.shadows == LightShadows.Soft)
            {
                float kernelRadius = 2.5f;
                switch (softShadowQuality)
                {
                    case SoftShadowQuality.High:
                        kernelRadius = 3.5f;
                        break; // 7x7
                    case SoftShadowQuality.Medium:
                        kernelRadius = 2.5f;
                        break; // 5x5
                    case SoftShadowQuality.Low:
                        kernelRadius = 1.5f;
                        break; // 3x3
                    default: break;
                }

                depthBias *= kernelRadius;
                normalBias *= kernelRadius;
            }

            return new Vector4(depthBias, normalBias, 0.0f, 0.0f);
        }

        /// <summary>
        /// Calculates the depth and normal bias from a light.
        /// </summary>
        /// <param name="shadowLight"></param>
        /// <param name="shadowLightIndex"></param>
        /// <param name="shadowData"></param>
        /// <param name="lightProjectionMatrix"></param>
        /// <param name="shadowResolution"></param>
        /// <returns>The depth and normal bias from a visible light.</returns>
        public static Vector4 BuiltinGetShadowBias(
            Light shadowLight,
            ShadowData data,
            SoftShadowQuality softShadowQuality
        )
        {
            float bias = -shadowLight.shadowBias * data.projectionMatrix[2 * 4 + 2];
            const float clampVerts = 1.0f;
            float normalOffsetBias = -shadowLight.shadowNormalBias;

            if (shadowLight.shadows == LightShadows.Soft)
            {
                float kernelRadius = 2.5f;
                switch (softShadowQuality)
                {
                    case SoftShadowQuality.High:
                        kernelRadius = 3.5f;
                        break; // 7x7
                    case SoftShadowQuality.Medium:
                        kernelRadius = 2.5f;
                        break; // 5x5
                    case SoftShadowQuality.Low:
                        kernelRadius = 1.5f;
                        break; // 3x3
                    default: break;
                }

                normalOffsetBias *= kernelRadius;
            }

            //  LightType: Directional
            float frustumSize = 2.0f / data.projectionMatrix.m00;

            // depth and normal bias scale is in shadowmap texel size in world space
            float texelSize = frustumSize / data.shadowMapResolution;
            normalOffsetBias *= texelSize;

            return new Vector4(bias, clampVerts, normalOffsetBias, shadowLight.shadowStrength);
        }

        public static void ComputeCameraDifferentials(Matrix4x4 invProjMat, float z, int width, int height,
            out Vector3 dxCamera, out Vector3 dyCamera)
        {
            Vector3 p = invProjMat.MultiplyPoint(new Vector3(0, 0, z));
            Vector3 px = invProjMat.MultiplyPoint(new Vector3(1.0f / width, 0, z));
            Vector3 py = invProjMat.MultiplyPoint(new Vector3(0, 1.0f / height, z));
            dxCamera = px - p;
            dyCamera = py - p;
        }

        public static float UnityNearClipValue()
        {
            if (SystemInfo.usesReversedZBuffer)
            {
                // reverse z is enabled for all [0,1] clip space coordinate
                return 1.0f;
            }
            else
            {
                // OGL family
                return -1.0f;
            }
        }

        public static float GetAdaptiveSoftness(CustomShadowMode shadowMode, bool isPerspective,float pcssSoftness)
        {
            float perspSoftnessScale = 2.0f;  //经验值 矫正
            float orthSoftnessScale = 0.02f;
            float softness = pcssSoftness;
            if (isPerspective)
                softness = (shadowMode == CustomShadowMode.DPCF)
                    ? pcssSoftness * 0.01f
                    : pcssSoftness * 0.01f * perspSoftnessScale;
            else
                softness = (shadowMode == CustomShadowMode.DPCF)
                    ? (pcssSoftness * orthSoftnessScale)
                    : pcssSoftness;
            return softness;
        }
        
        /// <summary>
        /// SetupShadowCasterConstantBuffer
        /// </summary>
        /// <param name="cmd"></param>
        /// <param name="shadowLight"></param>
        /// <param name="shadowBias"></param>
        /// <param name="data"></param>
        public static void SetupShadowCasterConstantBuffer(
            CommandBuffer cmd,
            Light shadowLight,
            ShadowData data,
            SoftShadowQuality softShadowQuality,
            CustomShadowMode shadowMode       = CustomShadowMode.PCF,
            float pcssSoftness                = 0.5f,
            int   pcssBlockerSampleCount      = 16,
            int   pcssFilterSampleCount       = 16,
            float pcssMinFilterRadius         = 0.01f,
            float pcssMaxFilterRadius         = 0.5f,
            bool  isPerspective               = false,
            Vector4 zBufferParams             = default,
            // Directional PCSS parameters (HDRP-aligned semantics)
            float dirRadial2DepthScale         = 0.0087f,
            float dirMaxPenumbraSize           = 0.56f,
            float dirMaxSamplingDistance       = 0.5f,
            float dirMinFilterSizeTexels       = 1.5f,
            float dirMinFilterMaxAngularDeg    = 10.0f,
            float dirBlockerSearchAngularDeg   = 12.0f,
            float dirBlockerClumpExponent      = 2.0f,
            // DPCF-only: soft-end floor for percentageOccluded, prevents leaking
            float dpcfPercentageOccludedMax    = 0.8f
        )
        {
            if (cmd == null || shadowLight == null)
                return;

            // DPCF reuses the same shader parameter layout as PCSS, but its perceived
            // softness grows much faster. Apply a smaller internal scale so the slider
            // remains usable without changing the exposed UI/serialized value.
            float effectiveSoftness = GetAdaptiveSoftness(shadowMode, isPerspective, pcssSoftness);

            Vector4 shadowBias = BuiltinGetShadowBias(shadowLight, data, softShadowQuality);

            cmd.Clear();
            cmd.SetGlobalVector("_ShadowBias", shadowBias);
            cmd.SetGlobalMatrix("customShadowViewM", data.viewMatrix);
            cmd.SetGlobalMatrix("customShadowProjM", data.projectionMatrix);
            cmd.SetGlobalFloat("_softShadowQuality", (int)softShadowQuality);

            if (shadowMode != CustomShadowMode.PCF)
            {
                // PCSS / DPCF parameters (skipped entirely in PCF mode)
                // _PcssPerspectiveParams0.z:
                //   PCSS  = filter sample count (both directional and perspective)
                //   DPCF  = directional: percentageOccludedMax (soft-end floor, prevents leaking)
                //           perspective: filter sample count (unused by shader, kept for safety)
                float paramZ;
                if (shadowMode == CustomShadowMode.DPCF)
                    // DPCF (both directional and perspective): paramZ = anti-leak floor.
                    // Directional reads it as dpcfOccludedFloor in shader.
                    // Perspective uses a fixed 0.85 heuristic (see URPCSS.hlsl comment),
                    // but we still pass the user value for future unification.
                    paramZ = Mathf.Clamp01(dpcfPercentageOccludedMax);
                else
                    paramZ = (float)pcssFilterSampleCount;
                cmd.SetGlobalVector("_PcssPerspectiveParams0", new Vector4(
                    effectiveSoftness,
                    (float)pcssBlockerSampleCount,
                    paramZ,
                    pcssMinFilterRadius));
                cmd.SetGlobalVector("_PcssPerspectiveParams1", new Vector4(
                    pcssMaxFilterRadius,
                    zBufferParams.x,
                    zBufferParams.y,
                    zBufferParams.z));
                cmd.SetGlobalFloat("_PcssIsPerspective", isPerspective ? 1f : 0f);

                // Directional PCSS parameters (only for orthographic / directional lights).
                // Mirrors HDRP's setup so blocker search and filtering use independent cone angles.
                if (!isPerspective)
                {
                    float halfAngularDiameterTan = Mathf.Max(dirRadial2DepthScale * Mathf.Max(effectiveSoftness, 0.001f), 1e-5f);
                    float shadowMapDepth2RadialScale = Mathf.Abs(data.projectionMatrix.m00 / data.projectionMatrix.m22);
                    float depth2RadialScale = halfAngularDiameterTan * shadowMapDepth2RadialScale;
                    float radial2DepthScale = 1.0f / Mathf.Max(depth2RadialScale, 1e-5f);

                    float maxSampleZDistance = (dirMaxPenumbraSize / (2.0f * halfAngularDiameterTan)) * Mathf.Abs(data.projectionMatrix.m22);
                    float maxPCSSOffset = dirMaxSamplingDistance * Mathf.Abs(data.projectionMatrix.m22);

                    float minFilterAngularDiameter = Mathf.Max(dirBlockerSearchAngularDeg, dirMinFilterMaxAngularDeg);
                    float halfMinFilterAngularTan = Mathf.Tan(0.5f * Mathf.Deg2Rad * Mathf.Max(minFilterAngularDiameter, 2.0f * Mathf.Rad2Deg * Mathf.Atan(halfAngularDiameterTan)));
                    float minFilterRadial2DepthScale = 1.0f / Mathf.Max(halfMinFilterAngularTan * shadowMapDepth2RadialScale, 1e-5f);

                    float halfBlockerSearchAngularTan = Mathf.Tan(0.5f * Mathf.Deg2Rad * Mathf.Max(dirBlockerSearchAngularDeg, 2.0f * Mathf.Rad2Deg * Mathf.Atan(halfAngularDiameterTan)));
                    float blockerRadial2DepthScale = 1.0f / Mathf.Max(halfBlockerSearchAngularTan * shadowMapDepth2RadialScale, 1e-5f);
                    float blockerClumpExponent = 0.5f * dirBlockerClumpExponent;

                    cmd.SetGlobalVector("_PcssDirectionalParams0", new Vector4(
                        depth2RadialScale,
                        radial2DepthScale,
                        maxSampleZDistance,
                        maxPCSSOffset));

                    cmd.SetGlobalVector("_PcssDirectionalParams1", new Vector4(
                        dirMinFilterSizeTexels,
                        minFilterRadial2DepthScale,
                        blockerRadial2DepthScale,
                        blockerClumpExponent));
                }

                if (shadowMode == CustomShadowMode.PCSS)
                    cmd.EnableShaderKeyword("_PBRV2_SHADOWS_PCSS");
                else
                    cmd.DisableShaderKeyword("_PBRV2_SHADOWS_PCSS");
            }
            else
            {
                cmd.DisableShaderKeyword("_PBRV2_SHADOWS_PCSS");
            }
        }

        // Compute HDRP-style depth linearization params: LinearizeDepth(d) = 1 / (x*d + y)
        // Returns (x, y, nearOverFarMinusNear, 0).
        // z = nearOverFarMinusNear is used by ComputePenumbraRatio for perspective penumbra.
        public static Vector4 ComputeZBufferParams(float near, float far)
        {
            near = Mathf.Max(near, 0.001f);
            float range = far - near;
            float nearOverFarMinusNear = near / range;
            if (SystemInfo.usesReversedZBuffer)
                return new Vector4(range / (near * far), 1.0f / far, nearOverFarMinusNear, 0f);
            else
                return new Vector4(-range / (near * far), 1.0f / near, nearOverFarMinusNear, 0f);
        }

        public static void SetPCSSKeyword(bool enabled)
        {
            if (enabled)
                Shader.EnableKeyword("_PBRV2_SHADOWS_SOFT");
            else
                Shader.DisableKeyword("_PBRV2_SHADOWS_SOFT");
        }


        /// <summary>
        /// 初始化光源
        /// </summary>
        /// <param name="mainLight"></param>
        /// <param name="shadowMapResolution"></param>
        /// <returns></returns>
        public static bool InitLight(ref Light shadowLight, ref ShadowData shadowData, ref CommandBuffer cmd, CommandBuffer cmdDepth = null)
        {
            if (shadowLight == null || cmd == null)
                return false;

            //  根据灯光设置分配阴影贴图大小
            shadowData.shadowMapResolution = ShadowMapResolution;
            shadowLight.shadowCustomResolution = ShadowMapResolution;

            if (shadowLight.commandBufferCount == 0)
                shadowLight.AddCommandBuffer(LightEvent.BeforeShadowMap, cmd);

            // 注册深度捕获 buffer（用于 PCSS blocker search 的原始深度采样）
            if (cmdDepth != null && shadowLight.commandBufferCount < 2)
                shadowLight.AddCommandBuffer(LightEvent.AfterShadowMap, cmdDepth);

            return true;
        }
        
        /// <summary>
        /// 设置阴影计数器增加
        /// </summary>
        /// <param name="count"></param>
        public static void SetShadowCtrlCountAdd(ref int count)
        {
            count++;
        }

        /// <summary>
        /// 设置阴影计数器减少
        /// </summary>
        /// <param name="count"></param>
        public static void SetShadowCtrlCountSub(ref int count)
        {
            count--;
        }

        /// <summary>
        /// 设置阴影关键字
        /// </summary>
        /// <param name="state"></param>
        public static void SetAdditionalLightKeyWords(bool state)
        {
            if (state)
            {
                Shader.EnableKeyword("MODE_CUSTOM");
                Shader.DisableKeyword("MODE_UNITY");
            }
            else
            {
                Shader.DisableKeyword("MODE_CUSTOM");
                Shader.EnableKeyword("MODE_UNITY");
            }
        }

        /// <summary>
        /// 设置 Slop Bias 开启与否
        /// </summary>
        /// <param name="state"></param>
        public static void SetDepthSlopBiasMode(bool state)
        {
            if(state)
                Shader.SetGlobalFloat("_EnableSlopBias",1);
            else
                Shader.SetGlobalFloat("_EnableSlopBias",0);
        }

        //  获取场景所有Renderer组件组合的AABB
        public static Bounds GetAdaptiveBound()
        {
            Bounds bounds = new Bounds();
            foreach (Renderer item in UnityEngine.Object.FindObjectsOfType(typeof(Renderer)))
            {
                if (item.shadowCastingMode != ShadowCastingMode.Off)
                    bounds.Encapsulate(item.bounds);
            }

            return bounds;
        }

        //  自适应阴影球
        public static void SetAdaptiveShadowSphere(ref Vector3 spherePosition, ref float sphereRadius, Vector3 thisPos)
        {
            Bounds bounds = GetAdaptiveBound();
            spherePosition = bounds.center - thisPos;

            sphereRadius = Mathf.Sqrt(Mathf.Pow((bounds.max.x - bounds.center.x), 2) +
                                      Mathf.Pow((bounds.max.y - bounds.center.y), 2) +
                                      Mathf.Pow((bounds.max.z - bounds.center.z), 2));
        }

        /// <summary>
        /// 创建OGL平台下的正交投影矩阵
        /// </summary>
        /// <param name="left"></param>
        /// <param name="right"></param>
        /// <param name="bottom"></param>
        /// <param name="top"></param>
        /// <param name="near"></param>
        /// <param name="far"></param>
        /// <returns></returns>
        public static Matrix4x4 CreateOpenGLOrthoMatrix(float left, float right, float bottom, float top, float near, float far)
        {
            Matrix4x4 orthoMatrix = new Matrix4x4();

            orthoMatrix.m00 = 2.0f / (right - left);
            orthoMatrix.m01 = 0;
            orthoMatrix.m02 = 0;
            orthoMatrix.m03 = - (right + left) / (right - left);

            orthoMatrix.m10 = 0;
            orthoMatrix.m11 = 2.0f / (top - bottom);
            orthoMatrix.m12 = 0;
            orthoMatrix.m13 = - (top + bottom) / (top - bottom);

            orthoMatrix.m20 = 0;
            orthoMatrix.m21 = 0;
            orthoMatrix.m22 = -2.0f / (far - near);
            orthoMatrix.m23 = - (far + near) / (far - near);

            orthoMatrix.m30 = 0;
            orthoMatrix.m31 = 0;
            orthoMatrix.m32 = 0;
            orthoMatrix.m33 = 1;

            return orthoMatrix;
        }
        
        /// <summary>
        /// 创建 DX/VK 平台下的正交投影矩阵
        /// </summary>
        /// <param name="left"></param>
        /// <param name="right"></param>
        /// <param name="bottom"></param>
        /// <param name="top"></param>
        /// <param name="near"></param>
        /// <param name="far"></param>
        /// <returns></returns>
        public static Matrix4x4 CreateDXOrthoMatrix(float left, float right, float bottom, float top, float near, float far)
        {
            Matrix4x4 orthoMatrix = new Matrix4x4();

            orthoMatrix.m00 = 2.0f / (right - left);
            orthoMatrix.m01 = 0;
            orthoMatrix.m02 = 0;
            orthoMatrix.m03 = - (right + left) / (right - left);

            orthoMatrix.m10 = 0;
            orthoMatrix.m11 = 2.0f / (top - bottom);
            orthoMatrix.m12 = 0;
            orthoMatrix.m13 = - (top + bottom) / (top - bottom);

            orthoMatrix.m20 = 0;
            orthoMatrix.m21 = 0;
            orthoMatrix.m22 = 1.0f / (far - near);
            orthoMatrix.m23 = - near / (far - near);

            orthoMatrix.m30 = 0;
            orthoMatrix.m31 = 0;
            orthoMatrix.m32 = 0;
            orthoMatrix.m33 = 1;

            return orthoMatrix;
        }
        
        /// <summary>
        /// 绘制Gizoms使用
        /// </summary>
        /// <param name="distance"></param>
        /// <param name="position"></param>
        /// <param name="forward"></param>
        /// <param name="right"></param>
        /// <param name="up"></param>
        /// <param name="size"></param>
        /// <returns></returns>
        public static Vector3[] GetOrthoCameraVector(
            float distance,
            Vector3 position,
            Vector3 forward,
            Vector3 right,
            Vector3 up,
            float size)
        {
            Vector3[] vectorArr = new Vector3[4];

            float halfHeight = size;
            float halfWidth = size;
            forward = position + forward * distance;
            right = right * halfWidth;
            Vector3 top = up * halfHeight;

            vectorArr[0] = forward + top - right; // top_left
            vectorArr[1] = forward + top + right; // top_right
            vectorArr[2] = forward - top + right; // bottom_right
            vectorArr[3] = forward - top - right; // bottom_left

            return vectorArr;
        }

        /// <summary>
        /// 设置TierSettings的Cascaded开关，Builtin管线（DX平台）如果开启状态默认是打开屏幕空间阴影的，所以这里需要关掉
        /// </summary>
        /// <param name="state"></param>
        public static void SetCascaedShadow(bool state)
        {
#if UNITY_EDITOR
            
            if (SystemInfo.graphicsDeviceType == GraphicsDeviceType.OpenGLES3 ||
                SystemInfo.graphicsDeviceType == GraphicsDeviceType.OpenGLCore)
                state = false;

            GraphicsTier currentTier = Graphics.activeTier;
            BuildTargetGroup target = EditorUserBuildSettings.selectedBuildTargetGroup;
            var tierSettings = UnityEditor.Rendering.EditorGraphicsSettings.GetTierSettings(target, currentTier);

            if(tierSettings.cascadedShadowMaps != state)
            {
                tierSettings.cascadedShadowMaps = state;
                UnityEditor.Rendering.EditorGraphicsSettings.SetTierSettings(target, currentTier, tierSettings);
            }
#endif
        }
    }
}

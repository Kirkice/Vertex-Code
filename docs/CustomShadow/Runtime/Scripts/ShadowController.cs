using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Rendering;
using UnityEngine;
using CustomShadow02;

[ExecuteAlways]
public class ShadowController : MonoBehaviour
{
    //  阴影球信息
    [SerializeField] public Vector3 spherePosition = Vector3.zero;
    [SerializeField] public float sphereRadius = 1.0f;
    [SerializeField] public bool drawGizmos = false;
    [SerializeField] public bool adaptiveBounds = false;
    
    //  阴影信息
    [SerializeField] public SoftShadowQuality softShadowQuality = SoftShadowQuality.Low;
    [SerializeField] [Range(0,2)]public float shadowBias = 0.01f;
    [SerializeField] [Range(0,3)]public float shadowNormalBias = 0.0f;
    [SerializeField] public Light targetLight;

    private static int sumControllerIndex = 0;
    public bool enableDefaultCullMask = true;

    public bool useV2 = false;
    //  TODO Depth Slop Bias 暂时不需要
    //[SerializeField] public bool enableDepthSlopBias = false;
    //[SerializeField] [Range(0, 20)]public float depthSlopeBias = 0.0f;
    //[SerializeField] public float depthBiasClamp = 16.0f;
    
    private ShadowData shadowData; 
    
    private CommandBuffer cmd;

    #if UNITY_ANDROID
    private Color shadowMapClearColor = Color.black;
    private float shadowMapClearDepth = 0.99999994f;
    private string gpuName;
    private string gpuVendor;
    #endif
    private void OnEnable()
    {
        if (useV2)
            return;
        
		//	关闭Cascaded 
        ShadowUtils.SetCascaedShadow(false);
        //  计数器 +1
        ShadowUtils.SetShadowCtrlCountAdd(ref sumControllerIndex);

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

        InitController();
    }
    
    private void Update()
    {
        if (useV2)
            return;
        
        if (CheckController() == false)
            return;
        
        //  更新灯光矩阵以及cbuffer
        targetLight.shadowBias = shadowBias;
        targetLight.shadowNormalBias = shadowNormalBias;
        float scale = this.transform.lossyScale.x;
        if (targetLight.type == LightType.Directional)
            ShadowUtils.ExtractDirectionalLightMatrix(ref shadowData, targetLight, spherePosition * scale + this.transform.position, sphereRadius * scale);
        
        //  先不去支持聚光灯
        // else if(targetLight.type == LightType.Spot)
        //     ShadowUtils.ExtractSpotLightMatrix(ref shadowData, targetLight, spherePosition * scale + this.transform.position, sphereRadius * scale);
        
        ShadowUtils.SetupShadowCasterConstantBuffer(cmd, targetLight,shadowData, softShadowQuality);
        
        //  TODO Depth Slop Bias 暂时不需要
        // ShadowUtils.SetupShadowCasterConstantBuffer(cmd, targetLight,shadowData, softShadowQuality, depthSlopeBias, depthBiasClamp);
        // ShadowUtils.SetDepthSlopBiasMode(enableDepthSlopBias);
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
    //ShadowController

    #region functions
    /// <summary>
    /// 设置目标灯光
    /// </summary>
    public void SetTargetLight(Light light,bool defaultCullMask = true)
    {
        if (useV2)
        {
            UseV2Controller(light, defaultCullMask);
            return;
        }
        
        targetLight = light;
        enableDefaultCullMask = defaultCullMask;
        
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

        InitController();
    }

    public void InitController()
    {
        if (targetLight == null || cmd == null || this.gameObject.active == false)
            return;

        //  开启Unity 阴影
        targetLight.shadows = LightShadows.Hard;
        if (enableDefaultCullMask)
        {
            targetLight.cullingMask = ~(1 << LayerMask.NameToLayer("Solider"));
        }

        QualitySettings.shadowDistance = 30.0f;

        //  初始化 shadow data
        shadowData.Init();
        
        //  初始化光源
        if(ShadowUtils.InitLight(ref targetLight, ref shadowData,ref cmd) == false)
            return;
        
        //  是否需要自适应包围盒
        if(adaptiveBounds)
            SetAdaptiveShadowSphere();
        
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

        //  cmd 释放
        cmd?.Clear();
        
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

    private void UseV2Controller(Light light,bool defaultCullMask = true)
    {
        if (useV2)
        {
            this.enabled = false;
            
            ShadowControllerV2 controllerv2 = this.GetComponent<ShadowControllerV2>();
            if (this.GetComponent<ShadowControllerV2>() == null)
                controllerv2 = this.gameObject.AddComponent<ShadowControllerV2>();

            if (this.GetComponent<ShadowControllerV2>() != null)
            {
                controllerv2.SetTargetLight(light,defaultCullMask);
                controllerv2.enabled = true;
            }
            
            ProjectorShadow projectorShadow = this.GetComponent<ProjectorShadow>();
            if (this.GetComponent<ProjectorShadow>() == null)
                projectorShadow = this.gameObject.AddComponent<ProjectorShadow>();
            
            if (this.GetComponent<ProjectorShadow>() != null && controllerv2!= null)
            {
                projectorShadow.shadowController = controllerv2;
                projectorShadow.enabled = true;
            }
        }
    }
    #endregion
}

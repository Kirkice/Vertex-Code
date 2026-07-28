using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using CustomShadow02;

[CustomEditor(typeof(ShadowControllerV2))]
[CanEditMultipleObjects]
public class ShadowControllerV2Editor : Editor
{
    private static class Styles
    {
        public static readonly GUIContent spherePositionLabel = new GUIContent("阴影球坐标", "阴影球坐标");
        public static readonly GUIContent sphereRadiusLabel = new GUIContent("阴影球半径", "阴影球半径");
        
        public static readonly GUIContent softShadowQualityLabel = new GUIContent("软阴影质量", "软阴影质量");
        public static readonly GUIContent shadowBiasLabel = new GUIContent("整体阴影偏移", "整体阴影偏移");
        public static readonly GUIContent shadowNormalBiasLabel = new GUIContent("法线阴影偏移", "法线阴影偏移");

        
        public static readonly GUIContent adaptiveBoundsLabel = new GUIContent("自适应包围盒", "自适应包围盒");
        public static readonly GUIContent drawGizmosLabel = new GUIContent("绘制阴影球", "绘制阴影球");
        public static readonly GUIContent drawDebugGizmosLabel = new GUIContent("绘制DebugGizmos", "绘制聚光灯阴影截面、锥体切片和最终投影AABB");
        
        public static readonly GUIContent targetLightLabel = new GUIContent("目标灯光", "目标灯光");

        public static readonly GUIContent shadowModeLabel         = new GUIContent("阴影模式",     "PCF=标准软阴影  DPCF=快速接触硬化  PCSS=高质量物理软阴影");
        public static readonly GUIContent pcssSoftnessLabel       = new GUIContent("软阴影范围",   "UV 空间搜索半径，值越大半影越宽");
        public static readonly GUIContent pcssBlockerCountLabel   = new GUIContent("遮挡搜索采样", "Blocker Search 采样数，越高越准确");
        public static readonly GUIContent dpcfBlockerCountLabel   = new GUIContent("DPCF遮挡搜索采样", "DPCF 模式 Blocker Search 采样数，DPCF 不做二次采样，可适当降低");
        public static readonly GUIContent pcssFilterCountLabel    = new GUIContent("滤波采样数",   "PCF Filter 采样数，越高越平滑");
        public static readonly GUIContent dpcfOccludedBiasLabel   = new GUIContent("DPCF 偏移值", "DPCF 偏移值");
        public static readonly GUIContent pcssMinFilterLabel      = new GUIContent("最小滤波半径", "防止接触处混叠的最小 filter radius");
        public static readonly GUIContent pcssMaxFilterLabel      = new GUIContent("最大滤波半径", "限制最大半影宽度，0 = 不限制");

        // public static readonly GUIContent enableDepthSlopBias = new GUIContent("启用斜率Bias", "启用斜率Bias");
        // public static readonly GUIContent depthSlopeBiasLabel = new GUIContent("深度梯度偏移", "深度梯度偏移");
        // public static readonly GUIContent depthBiasClampLabel = new GUIContent("深度梯度偏移区间", "深度梯度偏移区间");
    }
    
    private GUIStyle listTitleStyle;
    
    private SerializedProperty m_spherePosition;
    private SerializedProperty m_sphereRadius;
    private SerializedProperty m_softShadowQuality;
    private SerializedProperty m_shadowBias;
    private SerializedProperty m_shadowNormalBias;

    private SerializedProperty m_targetLight;
    private SerializedProperty m_drawGizmos;
    private SerializedProperty m_drawDebugGizmos;
    private SerializedProperty m_adaptiveBounds;

    private SerializedProperty m_shadowMode;
    private SerializedProperty m_pcssSoftness;
    private SerializedProperty m_pcssBlockerSampleCount;
    private SerializedProperty m_dpcfBlockerSampleCount;
    private SerializedProperty m_pcssFilterSampleCount;
    private SerializedProperty m_dpcfPercentageOccludedBias;
    private SerializedProperty m_pcssMinFilterRadius;
    private SerializedProperty m_pcssMaxFilterRadius;
    // private SerializedProperty m_enableDepthSlopBias;
    // private SerializedProperty m_depthSlopeBias;
    // private SerializedProperty m_depthBiasClamp;

    private void OnEnable()
    {
        if (listTitleStyle == null)
            GenerateListTitleStyle();
        
        m_spherePosition = serializedObject.FindProperty("spherePosition");
        m_sphereRadius = serializedObject.FindProperty("sphereRadius");
        m_softShadowQuality = serializedObject.FindProperty("softShadowQuality");
        m_shadowBias = serializedObject.FindProperty("shadowBias");
        m_shadowNormalBias = serializedObject.FindProperty("shadowNormalBias");
        m_targetLight = serializedObject.FindProperty("targetLight");
        m_drawGizmos = serializedObject.FindProperty("drawGizmos");
        m_drawDebugGizmos = serializedObject.FindProperty("drawDebugGizmos");
        m_adaptiveBounds = serializedObject.FindProperty("adaptiveBounds");

        m_shadowMode             = serializedObject.FindProperty("shadowMode");
        m_pcssSoftness           = serializedObject.FindProperty("pcssSoftness");
        m_pcssBlockerSampleCount = serializedObject.FindProperty("pcssBlockerSampleCount");
        m_dpcfBlockerSampleCount = serializedObject.FindProperty("dpcfBlockerSampleCount");
        m_pcssFilterSampleCount  = serializedObject.FindProperty("pcssFilterSampleCount");
        m_dpcfPercentageOccludedBias = serializedObject.FindProperty("dpcfPercentageOccludedBias");
        m_pcssMinFilterRadius    = serializedObject.FindProperty("pcssMinFilterRadius");
        m_pcssMaxFilterRadius    = serializedObject.FindProperty("pcssMaxFilterRadius");
        // m_enableDepthSlopBias = serializedObject.FindProperty("enableDepthSlopBias");
        // m_depthSlopeBias = serializedObject.FindProperty("depthSlopeBias");
        // m_depthBiasClamp = serializedObject.FindProperty("depthBiasClamp");
    }

    private void GenerateListTitleStyle()
    {
        listTitleStyle = new GUIStyle();
        listTitleStyle.border = new RectOffset(3, 3, 3, 3);
        listTitleStyle.margin = new RectOffset(2, 2, 2, 2);
        listTitleStyle.normal.textColor = Color.white;
        listTitleStyle.fontSize = 10;
        listTitleStyle.fontStyle = FontStyle.Bold;
        listTitleStyle.alignment = TextAnchor.MiddleLeft;
    }
    
    Vector2 scroll;

    public override void OnInspectorGUI()
    {
        using (var scope = new GUILayout.ScrollViewScope(scroll))
        {
            scroll = scope.scrollPosition;
            ShadowControllerV2 controller = (ShadowControllerV2)target;
            
            DrawTargetLightGUI();
            DrawShadowSphereGUI(controller);
            DrawShadowBiasGUI();
            DrawPCSSGUI();
            DrawProjectorShadowGUI();
        }

        serializedObject.ApplyModifiedProperties();
    }
    
    public static void BoxGUI(System.Action callback, int paddingH = 5, int paddingV = 5)
    {
        using (new GUILayout.HorizontalScope(GUI.skin.textField))
        {
            GUILayout.Space(paddingH);
            using (new GUILayout.VerticalScope())
            {
                GUILayout.Space(paddingV);
                callback.Invoke();
                GUILayout.Space(paddingV);
            }

            GUILayout.Space(paddingH);
        }
    }

    private void DrawTargetLightGUI()
    {
        var s = "Target Light Settings.";
        EditorGUILayout.HelpBox(s, MessageType.None);
        BoxGUI(() =>
        {
            EditorGUILayout.LabelField("【目标灯光设置】", listTitleStyle, GUILayout.Height(10), GUILayout.ExpandWidth(true));
            GUILayout.Space(5);

            EditorGUI.indentLevel++;
            EditorGUILayout.PropertyField(m_targetLight, Styles.targetLightLabel, true);
            EditorGUI.indentLevel--;   
            GUILayout.Space(10);
            if (m_targetLight.objectReferenceValue == null)
            {
                var str = "目标灯光为空，组件将不起作用，请添加目标灯光后点击重置按钮进行重置。";
                EditorGUILayout.HelpBox(str, MessageType.Error); 
            }
        });
    }
    
    private void DrawShadowSphereGUI(ShadowControllerV2 controller)
    {
        var s = "Shadow Sphere Settings.";
        EditorGUILayout.HelpBox(s, MessageType.None);

        BoxGUI(() =>
        {
            EditorGUILayout.LabelField("【阴影球设置】", listTitleStyle, GUILayout.Height(10), GUILayout.ExpandWidth(true));
            GUILayout.Space(5);
            EditorGUI.indentLevel++;
            EditorGUILayout.PropertyField(m_drawGizmos, Styles.drawGizmosLabel, true);
            EditorGUILayout.PropertyField(m_drawDebugGizmos, Styles.drawDebugGizmosLabel, true);
            EditorGUILayout.PropertyField(m_adaptiveBounds, Styles.adaptiveBoundsLabel, true);
            EditorGUILayout.PropertyField(m_spherePosition, Styles.spherePositionLabel, true);
            EditorGUILayout.PropertyField(m_sphereRadius, Styles.sphereRadiusLabel, true);
            
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("重置组件", GUILayout.Width(120));

            //  收集
            if (GUILayout.Button("重置", GUILayout.Width(80)))
            {
                controller.InitController();
            }


            GUILayout.Space(10);
            EditorGUILayout.EndHorizontal();
            
            EditorGUI.indentLevel--;
        });

        serializedObject.ApplyModifiedProperties();
    }

    private void DrawShadowBiasGUI()
    {
        var s = "Shadow Bias Settings.";
        EditorGUILayout.HelpBox(s, MessageType.None);

        BoxGUI(() =>
        {
            EditorGUILayout.LabelField("【阴影偏移设置】", listTitleStyle, GUILayout.Height(10), GUILayout.ExpandWidth(true));
            GUILayout.Space(5);
            EditorGUI.indentLevel++;
            // EditorGUILayout.PropertyField(m_softShadowQuality, Styles.softShadowQualityLabel, true);
            EditorGUILayout.PropertyField(m_shadowBias, Styles.shadowBiasLabel, true);
            EditorGUILayout.PropertyField(m_shadowNormalBias, Styles.shadowNormalBiasLabel, true);
            // EditorGUILayout.PropertyField(m_enableDepthSlopBias, Styles.enableDepthSlopBias, true);
            // EditorGUILayout.PropertyField(m_depthSlopeBias, Styles.depthSlopeBiasLabel, true);
            // EditorGUILayout.PropertyField(m_depthBiasClamp, Styles.depthBiasClampLabel, true);
            EditorGUI.indentLevel--;
        });

        serializedObject.ApplyModifiedProperties();
    }

    private void DrawPCSSGUI()
    {
        EditorGUILayout.HelpBox("Soft Shadow Mode Settings.", MessageType.None);

        BoxGUI(() =>
        {
            EditorGUILayout.LabelField("【软阴影模式设置】", listTitleStyle, GUILayout.Height(10), GUILayout.ExpandWidth(true));
            GUILayout.Space(5);
            EditorGUI.indentLevel++;

            EditorGUILayout.PropertyField(m_shadowMode, Styles.shadowModeLabel, true);

            var mode = (CustomShadowMode)m_shadowMode.enumValueIndex;
            if (mode != CustomShadowMode.PCF)
            {
                GUILayout.Space(4);
                EditorGUILayout.PropertyField(m_pcssSoftness,           Styles.pcssSoftnessLabel,     true);
                if (mode == CustomShadowMode.PCSS)
                {
                    EditorGUILayout.PropertyField(m_pcssBlockerSampleCount, Styles.pcssBlockerCountLabel, true);
                    EditorGUILayout.PropertyField(m_pcssFilterSampleCount,  Styles.pcssFilterCountLabel,  true);
                }
                else // DPCF
                {
                    EditorGUILayout.PropertyField(m_dpcfBlockerSampleCount, Styles.dpcfBlockerCountLabel, true);
                    EditorGUILayout.PropertyField(m_dpcfPercentageOccludedBias, Styles.dpcfOccludedBiasLabel, true);
                }
                EditorGUILayout.PropertyField(m_pcssMinFilterRadius,    Styles.pcssMinFilterLabel,    true);
                EditorGUILayout.PropertyField(m_pcssMaxFilterRadius,    Styles.pcssMaxFilterLabel,    true);

                if (mode == CustomShadowMode.DPCF)
                    EditorGUILayout.HelpBox("DPCF：快速近似，适合移动端。软阴影范围控制软硬过渡，DPCF最大软阴影控制防漏光下限。", MessageType.Info);
                else
                    EditorGUILayout.HelpBox("PCSS：启用 HDRP 距离补偿多项式，仅对透视光（SpotOnlyShadow）生效。", MessageType.Info);
            }

            EditorGUI.indentLevel--;
        });

        serializedObject.ApplyModifiedProperties();
    }

    private void DrawProjectorShadowGUI()
    {
        EditorGUILayout.HelpBox("Projector Shadow Settings.", MessageType.None);

        BoxGUI(() =>
        {
            EditorGUILayout.LabelField("【Projector Shadow 设置】", listTitleStyle, GUILayout.Height(10), GUILayout.ExpandWidth(true));
            GUILayout.Space(5);

            // 判断当前选中的 ShadowControllerV2 是否已挂载 ProjectorShadow 组件
            bool hasAny = false;
            foreach (Object obj in targets)
            {
                ShadowControllerV2 sc = (ShadowControllerV2)obj;
                if (sc.GetComponent<ProjectorShadow>() != null)
                {
                    hasAny = true;
                    break;
                }
            }

            if (hasAny)
            {
                EditorGUILayout.HelpBox("当前已挂载 Projector Shadow 组件，已开启复用 ShadowMap，投影光源自动联动 ShadowController。", MessageType.Info);

                GUILayout.Space(5);
                if (GUILayout.Button("移除 Projector Shadow"))
                {
                    foreach (Object obj in targets)
                    {
                        ShadowControllerV2 sc = (ShadowControllerV2)obj;
                        ProjectorShadow ps = sc.GetComponent<ProjectorShadow>();
                        if (ps != null)
                            Undo.DestroyObjectImmediate(ps);
                    }
                }
            }
            else
            {
                EditorGUILayout.HelpBox("点击下方按钮添加 Projector Shadow 组件，将自动开启复用 ShadowMap，并将投影光源联动到当前 ShadowController。", MessageType.Info);

                GUILayout.Space(5);
                if (GUILayout.Button("添加 Projector Shadow"))
                {
                    foreach (Object obj in targets)
                    {
                        ShadowControllerV2 sc = (ShadowControllerV2)obj;
                        if (sc.GetComponent<ProjectorShadow>() != null)
                            continue;

                        ProjectorShadow ps = Undo.AddComponent<ProjectorShadow>(sc.gameObject);
                        if (ps == null)
                            continue;

                        // 联动：开启复用 ShadowMap
                        ps.reuseShadowMap = true;
                        // 联动：投影光源自动获取 ShadowControllerV2 和 TargetLight
                        ps.shadowController = sc;
                        ps.targetLight = sc.targetLight;
                        EditorUtility.SetDirty(ps);
                    }
                }
            }
        });

        serializedObject.ApplyModifiedProperties();
    }
}

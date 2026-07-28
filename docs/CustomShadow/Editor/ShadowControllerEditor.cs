using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

[CustomEditor(typeof(ShadowController))]
[CanEditMultipleObjects]
public class ShadowControllerEditor : Editor
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
        
        public static readonly GUIContent targetLightLabel = new GUIContent("目标灯光", "目标灯光");
        public static readonly GUIContent useV2Label = new GUIContent("使用V2", "启用V2阴影控制器逻辑");
        
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
    private SerializedProperty m_adaptiveBounds;
    private SerializedProperty m_useV2;
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
        m_adaptiveBounds = serializedObject.FindProperty("adaptiveBounds");
        m_useV2 = serializedObject.FindProperty("useV2");
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
            ShadowController controller = (ShadowController)target;
            
            DrawTargetLightGUI();
            DrawShadowSphereGUI(controller);
            DrawShadowBiasGUI();
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
    
    private void DrawShadowSphereGUI(ShadowController controller)
    {
        var s = "Shadow Sphere Settings.";
        EditorGUILayout.HelpBox(s, MessageType.None);

        BoxGUI(() =>
        {
            EditorGUILayout.LabelField("【阴影球设置】", listTitleStyle, GUILayout.Height(10), GUILayout.ExpandWidth(true));
            GUILayout.Space(5);
            EditorGUI.indentLevel++;
            EditorGUILayout.PropertyField(m_useV2, Styles.useV2Label, true);
            EditorGUILayout.PropertyField(m_drawGizmos, Styles.drawGizmosLabel, true);
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
}

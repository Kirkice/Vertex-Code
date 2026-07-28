using CustomShadow02;
using UnityEditor;
using UnityEngine;

[CustomEditor(typeof(ProjectorShadow))]
[CanEditMultipleObjects]
public class ProjectorShadowEditor : Editor
{
    private SerializedProperty m_TargetLight;
    private SerializedProperty m_ShadowController;
    private SerializedProperty m_ProjectorRenderers;
    private SerializedProperty m_Bound;
    private SerializedProperty m_DrawGizmos;
    private SerializedProperty m_Quality;
    private SerializedProperty m_ReuseShadowMap;
    private SerializedProperty m_ShadowStrength;
    private SerializedProperty m_EnableBlur;
    private SerializedProperty m_BlurSize;
    private SerializedProperty m_BlurIterations;
    private SerializedProperty m_DownSample;
    private SerializedProperty m_BlurType;
    private SerializedProperty m_BlurKernel;
    private SerializedProperty m_EnableBlurFade;
    private SerializedProperty m_FadeInterpolationMode;
    private SerializedProperty m_MinBlurSize;
    private SerializedProperty m_FadeDirection;
    private SerializedProperty m_FadeStart;
    private SerializedProperty m_FadeEnd;
    private SerializedProperty m_BlurFadeCurve;
    private SerializedProperty m_EnableIntensityFade;
    private SerializedProperty m_IntensityFadeDirection;
    private SerializedProperty m_IntensityFadeStart;
    private SerializedProperty m_IntensityFadeEnd;
    private SerializedProperty m_IntensityFadeCurve;
    private SerializedProperty m_ShadowColorInterpolationCurve;

    // Shadow Softness Link
    private SerializedProperty m_EnableShadowSoftnessLink;
    private SerializedProperty m_MinArea;
    private SerializedProperty m_MaxArea;
    private SerializedProperty m_AreaPower;
    private SerializedProperty m_MinBlurSizeLink;
    private SerializedProperty m_MaxBlurSizeLink;
    private SerializedProperty m_MinBlurIterations;
    private SerializedProperty m_MaxBlurIterations;
    private SerializedProperty m_MinDownSample;
    private SerializedProperty m_MaxDownSample;
    private SerializedProperty m_MinMinBlurSize;
    private SerializedProperty m_MaxMinBlurSize;
    private SerializedProperty m_MinFadeStart;
    private SerializedProperty m_MaxFadeStart;
    private SerializedProperty m_MinFadeEnd;
    private SerializedProperty m_MaxFadeEnd;
    private SerializedProperty m_MinIntensityFadeStart;
    private SerializedProperty m_MaxIntensityFadeStart;
    private SerializedProperty m_MinIntensityFadeEnd;
    private SerializedProperty m_MaxIntensityFadeEnd;

    private bool m_FoldoutProjectorShadowSettings = true;
    private bool m_FoldoutProjectorCasterSettings = true;
    private bool m_FoldoutProjectorLightSettings = true;
    private bool m_FoldoutShadowSoftnessLink = false;
    private bool m_FoldoutBlur = true;
    private bool m_FoldoutBlurFade = true;
    private bool m_FoldoutIntensityFade = true;

    private GUIStyle m_ListTitleStyle;
    private GUIStyle m_TopHintBoxStyle;
    private GUIStyle m_TopHintLabelStyle;
    private GUIStyle m_TopWarningBoxStyle;
    private GUIStyle m_TopWarningLabelStyle;

    private static class Styles
    {
        public static readonly GUIContent quality = new GUIContent("质量", "Projector mask 分辨率：Low=128, Medium=256, High=512, Ultra=1024");
        public static readonly GUIContent reuseShadowMap = new GUIContent("复用 ShadowMap", "开启后不再自己 DrawRenderer，而是在 AfterShadowMap 阶段把深度纹理 blit 转换为颜色纹理，省掉 DrawCasters 的 DrawCall。\n注意：复用模式下 _CameraProjectorMap 会包含 shadowmap 中所有 caster 的阴影。");
        public static readonly GUIContent shadowStrength = new GUIContent("阴影强度", "0=不叠加 Projector 阴影，1=完整叠加");
        public static readonly GUIContent targetLight = new GUIContent("目标灯光", "仅使用灯光的位置/方向/类型计算投影矩阵，不依赖灯光 ShadowMap");
        public static readonly GUIContent shadowController = new GUIContent("Shadow Controller", "优先复用 ShadowController 的阴影球范围；为空时使用下面的备用投影范围");
        public static readonly GUIContent bound = new GUIContent("备用投影范围", "仅在没有 ShadowController 时使用。Projector 包围球半径，用于计算平行光正交范围或 Spot 包络锥体");
        public static readonly GUIContent drawGizmos = new GUIContent("绘制范围", "在 SceneView 中绘制 Projector 包围球");
        public static readonly GUIContent projectorRenderers = new GUIContent("投影 Renderer 列表", "手动指定需要写入 _CameraProjectorMap 的 Renderer，避免全场景扫描和批量修改 shader");
        public static readonly GUIContent enableBlur = new GUIContent("开启模糊", "对 _CameraProjectorMap 做 Kawase 模糊");
        public static readonly GUIContent blurSize = new GUIContent("模糊大小");
        public static readonly GUIContent blurIterations = new GUIContent("模糊迭代");
        public static readonly GUIContent downSample = new GUIContent("降采样");
        public static readonly GUIContent blurType = new GUIContent("模糊类型", "Kawase / Gaussian / Uniform");
        public static readonly GUIContent blurKernel = new GUIContent("Kernel", "Gaussian/Uniform 使用的 separable blur kernel tap 数");
        public static readonly GUIContent enableBlurFade = new GUIContent("开启模糊渐变", "沿指定 UV 方向从最小模糊半径渐变到最大模糊半径");
        public static readonly GUIContent fadeInterpolationMode = new GUIContent("渐变插值模式", "线性插值不使用 LUT；曲线插值使用一张 RGB LUT");
        public static readonly GUIContent minBlurSize = new GUIContent("最小模糊大小", "渐变起点处的模糊半径，0 表示起点保持锐利");
        public static readonly GUIContent fadeDirection = new GUIContent("模糊渐变方向", "UV 空间方向：(0,1)=自下而上，(1,0)=自左而右");
        public static readonly GUIContent fadeStart = new GUIContent("模糊渐变起点", "dot(uv, dir) 映射到曲线 0 的位置");
        public static readonly GUIContent fadeEnd = new GUIContent("模糊渐变终点", "dot(uv, dir) 映射到曲线 1 的位置");
        public static readonly GUIContent blurFadeCurve = new GUIContent("模糊渐变曲线", "X=渐变位置 t，Y=有效模糊系数");
        public static readonly GUIContent enableIntensityFade = new GUIContent("开启强度渐变");
        public static readonly GUIContent intensityFadeDirection = new GUIContent("渐变方向", "UV 空间方向：(0,1)=自下而上，(1,0)=自左而右");
        public static readonly GUIContent intensityFadeStart = new GUIContent("渐变起点", "dot(uv, dir) 映射到曲线 0 的位置");
        public static readonly GUIContent intensityFadeEnd = new GUIContent("渐变终点", "dot(uv, dir) 映射到曲线 1 的位置");
        public static readonly GUIContent intensityFadeCurve = new GUIContent("强度曲线", "X=渐变位置 t，Y=阴影强度系数");
        public static readonly GUIContent shadowColorInterpolationCurve = new GUIContent("颜色插值曲线", "X=light.shadowAttenuation，Y=EdgeColor 到材质 ShadowColor 的混合系数");
    }

    private void OnEnable()
    {
        GenerateListTitleStyle();
        CacheSerializedProperties();
    }

    private void CacheSerializedProperties()
    {
        if (serializedObject == null)
            return;

        m_TargetLight = serializedObject.FindProperty("targetLight");
        m_ShadowController = serializedObject.FindProperty("shadowController");
        m_ProjectorRenderers = serializedObject.FindProperty("projectorRenderers");
        m_Bound = serializedObject.FindProperty("bound");
        m_DrawGizmos = serializedObject.FindProperty("drawGizmos");
        m_Quality = serializedObject.FindProperty("quality");
        m_ReuseShadowMap = serializedObject.FindProperty("reuseShadowMap");
        m_ShadowStrength = serializedObject.FindProperty("shadowStrength");
        m_EnableBlur = serializedObject.FindProperty("enableBlur");
        m_BlurSize = serializedObject.FindProperty("blurSize");
        m_BlurIterations = serializedObject.FindProperty("blurIterations");
        m_DownSample = serializedObject.FindProperty("downSample");
        m_BlurType = serializedObject.FindProperty("blurType");
        m_BlurKernel = serializedObject.FindProperty("blurKernel");
        m_EnableBlurFade = serializedObject.FindProperty("enableBlurFade");
        m_FadeInterpolationMode = serializedObject.FindProperty("fadeInterpolationMode");
        m_MinBlurSize = serializedObject.FindProperty("minBlurSize");
        m_FadeDirection = serializedObject.FindProperty("fadeDirection");
        m_FadeStart = serializedObject.FindProperty("fadeStart");
        m_FadeEnd = serializedObject.FindProperty("fadeEnd");
        m_BlurFadeCurve = serializedObject.FindProperty("blurFadeCurve");
        m_EnableIntensityFade = serializedObject.FindProperty("enableIntensityFade");
        m_IntensityFadeDirection = serializedObject.FindProperty("intensityFadeDirection");
        m_IntensityFadeStart = serializedObject.FindProperty("intensityFadeStart");
        m_IntensityFadeEnd = serializedObject.FindProperty("intensityFadeEnd");
        m_IntensityFadeCurve = serializedObject.FindProperty("intensityFadeCurve");
        m_ShadowColorInterpolationCurve = serializedObject.FindProperty("shadowColorInterpolationCurve");

        m_EnableShadowSoftnessLink = serializedObject.FindProperty("enableShadowSoftnessLink");
        m_MinArea = serializedObject.FindProperty("minArea");
        m_MaxArea = serializedObject.FindProperty("maxArea");
        m_AreaPower = serializedObject.FindProperty("areaPower");
        m_MinBlurSizeLink = serializedObject.FindProperty("minBlurSizeLink");
        m_MaxBlurSizeLink = serializedObject.FindProperty("maxBlurSizeLink");
        m_MinBlurIterations = serializedObject.FindProperty("minBlurIterations");
        m_MaxBlurIterations = serializedObject.FindProperty("maxBlurIterations");
        m_MinDownSample = serializedObject.FindProperty("minDownSample");
        m_MaxDownSample = serializedObject.FindProperty("maxDownSample");
        m_MinMinBlurSize = serializedObject.FindProperty("minMinBlurSize");
        m_MaxMinBlurSize = serializedObject.FindProperty("maxMinBlurSize");
        m_MinFadeStart = serializedObject.FindProperty("minFadeStart");
        m_MaxFadeStart = serializedObject.FindProperty("maxFadeStart");
        m_MinFadeEnd = serializedObject.FindProperty("minFadeEnd");
        m_MaxFadeEnd = serializedObject.FindProperty("maxFadeEnd");
        m_MinIntensityFadeStart = serializedObject.FindProperty("minIntensityFadeStart");
        m_MaxIntensityFadeStart = serializedObject.FindProperty("maxIntensityFadeStart");
        m_MinIntensityFadeEnd = serializedObject.FindProperty("minIntensityFadeEnd");
        m_MaxIntensityFadeEnd = serializedObject.FindProperty("maxIntensityFadeEnd");
    }

    private bool EnsureInspectorReady()
    {
        if (m_Quality == null || m_ReuseShadowMap == null || m_TargetLight == null || m_ProjectorRenderers == null)
            CacheSerializedProperties();

        if (m_Quality != null && m_ReuseShadowMap != null && m_TargetLight != null && m_ProjectorRenderers != null)
            return true;

        EditorGUILayout.HelpBox("ProjectorShadow Inspector 初始化中，请等待脚本编译完成后重新选中对象。", MessageType.Warning);
        return false;
    }

    public override void OnInspectorGUI()
    {
        if (!EnsureInspectorReady())
            return;

        serializedObject.Update();

        DrawTopHintBanner();
        DrawTopWarningBanner();
        GUILayout.Space(6);

        DrawShadowSettings();
        GUILayout.Space(5);
        if (!m_ReuseShadowMap.boolValue)
        {
            DrawCasterSettings();
            GUILayout.Space(5);
        }
        DrawLightSettings();
        GUILayout.Space(5);
        DrawShadowSoftnessLinkSettings();

        if (serializedObject.ApplyModifiedProperties())
        {
            foreach (Object targetObject in targets)
                ((ProjectorShadow)targetObject).UpdateFadeCurveLut();
        }
    }

    private void DrawShadowSettings()
    {
        EditorGUILayout.HelpBox("Projector Shadow Settings.", MessageType.None);
        BoxGUI(() =>
        {
            m_FoldoutProjectorShadowSettings = EditorGUILayout.Foldout(m_FoldoutProjectorShadowSettings, "【Projector 阴影设置】", true, m_ListTitleStyle);
            if (!m_FoldoutProjectorShadowSettings) return;
            GUILayout.Space(5);

            EditorGUI.indentLevel++;
            EditorGUILayout.PropertyField(m_Quality, Styles.quality);
            EditorGUILayout.PropertyField(m_ReuseShadowMap, Styles.reuseShadowMap);
            EditorGUILayout.Slider(m_ShadowStrength, 0.0f, 1.0f, Styles.shadowStrength);
            GUILayout.Space(8);

            EditorGUILayout.PropertyField(m_EnableBlur, Styles.enableBlur);
            using (new EditorGUI.DisabledScope(!m_EnableBlur.boolValue))
            {
                EditorGUI.indentLevel++;
                EditorGUILayout.PropertyField(m_BlurType, Styles.blurType);
                EditorGUILayout.PropertyField(m_BlurKernel, Styles.blurKernel);
                EditorGUILayout.Slider(m_BlurSize, 0.0f, 10.0f, Styles.blurSize);
                EditorGUILayout.IntSlider(m_BlurIterations, 0, 10, Styles.blurIterations);
                EditorGUILayout.Slider(m_DownSample, 1.0f, 4.0f, Styles.downSample);

                GUILayout.Space(6);
                EditorGUILayout.PropertyField(m_FadeInterpolationMode, Styles.fadeInterpolationMode);
                EditorGUILayout.PropertyField(m_EnableBlurFade, Styles.enableBlurFade);
                if (m_EnableBlurFade.boolValue)
                {
                    EditorGUI.indentLevel++;
                    EditorGUILayout.Slider(m_MinBlurSize, 0.0f, 10.0f, Styles.minBlurSize);
                    EditorGUILayout.PropertyField(m_FadeDirection, Styles.fadeDirection);
                    EditorGUILayout.Slider(m_FadeStart, 0.0f, 2.0f, Styles.fadeStart);
                    EditorGUILayout.Slider(m_FadeEnd, 0.0f, 2.0f, Styles.fadeEnd);
                    if (m_FadeInterpolationMode.enumValueIndex == (int)ProjectorShadow.FadeInterpolationMode.CurveLut)
                        EditorGUILayout.CurveField(m_BlurFadeCurve, Color.cyan, new Rect(0, 0, 1, 1), Styles.blurFadeCurve);
                    EditorGUI.indentLevel--;
                }
                EditorGUI.indentLevel--;
            }

            GUILayout.Space(8);
            EditorGUILayout.PropertyField(m_EnableIntensityFade, Styles.enableIntensityFade);
            if (m_EnableIntensityFade.boolValue)
            {
                EditorGUI.indentLevel++;
                EditorGUILayout.PropertyField(m_IntensityFadeDirection, Styles.intensityFadeDirection);
                EditorGUILayout.Slider(m_IntensityFadeStart, 0.0f, 2.0f, Styles.intensityFadeStart);
                EditorGUILayout.Slider(m_IntensityFadeEnd, 0.0f, 2.0f, Styles.intensityFadeEnd);
                if (m_FadeInterpolationMode.enumValueIndex == (int)ProjectorShadow.FadeInterpolationMode.CurveLut)
                    EditorGUILayout.CurveField(m_IntensityFadeCurve, Color.red, new Rect(0, 0, 1, 1), Styles.intensityFadeCurve);
                EditorGUI.indentLevel--;
            }

            GUILayout.Space(8);
            if (m_FadeInterpolationMode.enumValueIndex == (int)ProjectorShadow.FadeInterpolationMode.CurveLut)
                EditorGUILayout.CurveField(m_ShadowColorInterpolationCurve, Color.white, new Rect(0, 0, 1, 1), Styles.shadowColorInterpolationCurve);
            EditorGUI.indentLevel--;
        });
    }

    private void DrawCasterSettings()
    {
        EditorGUILayout.HelpBox("Projector Caster Settings.", MessageType.None);
        BoxGUI(() =>
        {
            m_FoldoutProjectorCasterSettings = EditorGUILayout.Foldout(m_FoldoutProjectorCasterSettings, "【投影物体设置】", true, m_ListTitleStyle);
            if (!m_FoldoutProjectorCasterSettings) return;
            GUILayout.Space(5);

            EditorGUI.indentLevel++;
            EditorGUILayout.PropertyField(m_ProjectorRenderers, Styles.projectorRenderers, true);
            EditorGUI.indentLevel--;

            GUILayout.Space(6);
            using (new GUILayout.HorizontalScope())
            {
                if (GUILayout.Button("添加选中 Renderer"))
                    AddSelectedRenderers();
                if (GUILayout.Button("清理空引用"))
                    RemoveNullRenderers();
            }

            if (m_ProjectorRenderers.arraySize == 0)
                EditorGUILayout.HelpBox("Renderer 列表为空时不会生成任何 Projector 阴影。请手动拖入需要投影的 Renderer，或点击“添加选中 Renderer”。", MessageType.Info);
        });
    }

    private void DrawLightSettings()
    {
        EditorGUILayout.HelpBox("Projector Light Settings.", MessageType.None);
        BoxGUI(() =>
        {
            m_FoldoutProjectorLightSettings = EditorGUILayout.Foldout(m_FoldoutProjectorLightSettings, "【投影光源设置】", true, m_ListTitleStyle);
            if (!m_FoldoutProjectorLightSettings) return;
            GUILayout.Space(5);

            // 已联动 ShadowController 时，投影光源自动获取，Bound 由 ShadowController 的 Gizmos 显示，
            // 此分组无需任何手动设置，仅保留提示信息。
            if (m_ShadowController.objectReferenceValue != null)
            {
                EditorGUILayout.HelpBox("已联动 ShadowController，投影光源（targetLight、spherePosition / sphereRadius）将自动从 ShadowController 获取，无需手动设置。\n投影范围请通过 ShadowController 的“绘制阴影球” Gizmos 查看。", MessageType.Info);
                return;
            }

            EditorGUI.indentLevel++;
            EditorGUILayout.PropertyField(m_ShadowController, Styles.shadowController);
            using (new EditorGUI.DisabledScope(m_ShadowController.objectReferenceValue != null))
            {
                EditorGUILayout.PropertyField(m_TargetLight, Styles.targetLight);
            }
            using (new EditorGUI.DisabledScope(m_ShadowController.objectReferenceValue != null))
            {
                EditorGUILayout.PropertyField(m_Bound, Styles.bound);
            }
            EditorGUILayout.PropertyField(m_DrawGizmos, Styles.drawGizmos);
            EditorGUI.indentLevel--;

            Light light = m_TargetLight.objectReferenceValue as Light;
            if (light == null)
                EditorGUILayout.HelpBox("目标灯光为空，ProjectorShadow 不会渲染。", MessageType.Error);
            else if (!IsSupportedProjectorLight(light))
                EditorGUILayout.HelpBox("当前仅支持 Directional、Spot、SpotOnlyShadow 和 SpotVirtual 类型灯光。", MessageType.Info);

            EditorGUILayout.HelpBox("未指定 ShadowController，将使用备用投影范围。", MessageType.None);
        });
    }

    private static bool IsSupportedProjectorLight(Light light)
    {
        if (light.type == LightType.Directional || light.type == LightType.Spot)
            return true;

        MTAdditionalLightData additionalLightData = light.GetComponent<MTAdditionalLightData>();
        return additionalLightData != null &&
               (additionalLightData.CurrentLightType == MTLightType.SpotOnlyShadow ||
                additionalLightData.CurrentLightType == MTLightType.SpotVirtual);
    }

    private void AddSelectedRenderers()
    {
        serializedObject.Update();
        foreach (GameObject gameObject in Selection.gameObjects)
        {
            Renderer[] renderers = gameObject.GetComponentsInChildren<Renderer>(true);
            for (int i = 0; i < renderers.Length; i++)
                AddRendererIfMissing(renderers[i]);
        }
        serializedObject.ApplyModifiedProperties();
    }

    private void AddRendererIfMissing(Renderer renderer)
    {
        if (renderer == null)
            return;

        for (int i = 0; i < m_ProjectorRenderers.arraySize; i++)
        {
            if (m_ProjectorRenderers.GetArrayElementAtIndex(i).objectReferenceValue == renderer)
                return;
        }

        int index = m_ProjectorRenderers.arraySize;
        m_ProjectorRenderers.InsertArrayElementAtIndex(index);
        m_ProjectorRenderers.GetArrayElementAtIndex(index).objectReferenceValue = renderer;
    }

    private void RemoveNullRenderers()
    {
        serializedObject.Update();
        for (int i = m_ProjectorRenderers.arraySize - 1; i >= 0; i--)
        {
            if (m_ProjectorRenderers.GetArrayElementAtIndex(i).objectReferenceValue == null)
                m_ProjectorRenderers.DeleteArrayElementAtIndex(i);
        }
        serializedObject.ApplyModifiedProperties();
    }

    private void GenerateListTitleStyle()
    {
        m_ListTitleStyle = new GUIStyle
        {
            border = new RectOffset(3, 3, 3, 3),
            margin = new RectOffset(2, 2, 2, 2),
            fontSize = 10,
            fontStyle = FontStyle.Bold,
            alignment = TextAnchor.MiddleLeft,
        };
        m_ListTitleStyle.normal.textColor = Color.white;
    }

    private void GenerateTopHintStyles()
    {
        GUIStyle baseHelpBox = GUI.skin != null ? GUI.skin.box : EditorStyles.textField;
        GUIStyle baseLabel = GUI.skin != null ? GUI.skin.label : EditorStyles.label;

        m_TopHintBoxStyle = new GUIStyle(baseHelpBox)
        {
            padding = new RectOffset(10, 10, 8, 8),
            margin = new RectOffset(0, 0, 4, 8)
        };

        m_TopHintLabelStyle = new GUIStyle(baseLabel)
        {
            richText = true,
            wordWrap = true,
            fontSize = 11,
            alignment = TextAnchor.MiddleLeft
        };

        m_TopWarningBoxStyle = new GUIStyle(baseHelpBox)
        {
            padding = new RectOffset(12, 12, 10, 10),
            margin = new RectOffset(0, 0, 2, 8)
        };

        m_TopWarningLabelStyle = new GUIStyle(baseLabel)
        {
            richText = true,
            wordWrap = true,
            fontSize = 12,
            fontStyle = FontStyle.Bold,
            alignment = TextAnchor.MiddleLeft
        };
    }

    private void DrawTopHintBanner()
    {
        if (m_TopHintBoxStyle == null || m_TopHintLabelStyle == null || m_TopWarningBoxStyle == null || m_TopWarningLabelStyle == null)
            GenerateTopHintStyles();

        const string hintText = "<size=13><b>功能提示</b></size>\n点击各分组标题可以进行功能折叠和显示";
        Color prevContentColor = GUI.contentColor;
        float viewWidth = EditorGUIUtility.currentViewWidth;
        float textWidth = Mathf.Max(120f, viewWidth - 36f);
        float textHeight = m_TopHintLabelStyle.CalcHeight(new GUIContent(hintText), textWidth);
        float bannerHeight = Mathf.Max(40f, textHeight + 16f);

        Rect rect = EditorGUILayout.BeginVertical();
        GUILayout.Space(bannerHeight);
        EditorGUILayout.EndVertical();

        EditorGUI.DrawRect(rect, new Color(0.72f, 0.88f, 1.00f, 1.00f));
        EditorGUI.DrawRect(new Rect(rect.x, rect.y, 4f, rect.height), new Color(0.20f, 0.55f, 0.90f, 1.00f));
        GUI.contentColor = new Color(0.06f, 0.18f, 0.32f, 1.00f);
        GUI.Label(new Rect(rect.x + 10f, rect.y + 8f, rect.width - 20f, rect.height - 16f),
            hintText, m_TopHintLabelStyle);
        GUI.contentColor = prevContentColor;
    }

    private void DrawTopWarningBanner()
    {
        if (m_TopHintBoxStyle == null || m_TopHintLabelStyle == null || m_TopWarningBoxStyle == null || m_TopWarningLabelStyle == null)
            GenerateTopHintStyles();

        Color prevContentColor = GUI.contentColor;
        GUI.contentColor = new Color(0.20f, 0.10f, 0.00f, 1.00f);

        Rect rect = EditorGUILayout.BeginVertical();
        GUILayout.Space(62f);
        EditorGUILayout.EndVertical();

        EditorGUI.DrawRect(rect, new Color(1.00f, 0.86f, 0.36f, 1.00f));
        EditorGUI.DrawRect(new Rect(rect.x, rect.y, 4f, rect.height), new Color(0.90f, 0.45f, 0.05f, 1.00f));
        GUI.Label(new Rect(rect.x + 12f, rect.y + 8f, rect.width - 24f, rect.height - 16f),
            "<size=13><b>⚠ 材质配置警告</b></size>\n场景物件需要   开启 <b>“接收 Projector Shadow”</b>，关闭 <b>“接收阴影”</b>。\n角色材质需要   关闭 <b>“接收 Projector Shadow”</b>，开启 <b>“接收阴影”</b>。", m_TopWarningLabelStyle);

        GUI.contentColor = prevContentColor;
    }

    private void DrawShadowSoftnessLinkSettings()
    {
        EditorGUILayout.HelpBox("Shadow Softness Link (Area Light).", MessageType.None);
        BoxGUI(() =>
        {
        m_FoldoutShadowSoftnessLink = EditorGUILayout.Foldout(m_FoldoutShadowSoftnessLink, "【面积光阴影柔和度联动】", true, m_ListTitleStyle);
        if (!m_FoldoutShadowSoftnessLink) return;
        GUILayout.Space(5);

            EditorGUI.indentLevel++;
            EditorGUILayout.PropertyField(m_EnableShadowSoftnessLink, new GUIContent("启用联动", "根据 AreaLight 面积自动插值阴影柔和参数"));

            // 面积映射范围 (仅开关关闭时灰显)
            using (new EditorGUI.DisabledScope(!m_EnableShadowSoftnessLink.boolValue))
            {
                GUILayout.Space(6);
                EditorGUILayout.LabelField("面积映射范围", EditorStyles.boldLabel);
                EditorGUI.indentLevel++;
                EditorGUILayout.PropertyField(m_MinArea, new GUIContent("最小面积"));
                EditorGUILayout.PropertyField(m_MaxArea, new GUIContent("最大面积"));
                EditorGUILayout.PropertyField(m_AreaPower, new GUIContent("面积指数", "面积归一化后的幂曲线，>1 偏向小面积端，<1 偏向大面积端"));
                EditorGUI.indentLevel--;
            }

            // ── Blur ──
            GUILayout.Space(6);
            m_FoldoutBlur = EditorGUILayout.Foldout(m_FoldoutBlur, "Blur 参数", true, EditorStyles.foldoutHeader);
            if (m_FoldoutBlur)
            {
                EditorGUI.indentLevel++;
                DrawMinMaxFloat("模糊大小", m_MinBlurSizeLink, m_MaxBlurSizeLink, 0f, 10f);
                DrawMinMaxInt("模糊迭代", m_MinBlurIterations, m_MaxBlurIterations, 0, 10);
                DrawMinMaxFloat("降采样", m_MinDownSample, m_MaxDownSample, 1f, 4f);
                EditorGUI.indentLevel--;
            }

            // ── Blur Fade ──
            GUILayout.Space(6);
            m_FoldoutBlurFade = EditorGUILayout.Foldout(m_FoldoutBlurFade, "Blur Fade 参数", true, EditorStyles.foldoutHeader);
            if (m_FoldoutBlurFade)
            {
                EditorGUI.indentLevel++;
                DrawMinMaxFloat("最小模糊", m_MinMinBlurSize, m_MaxMinBlurSize, 0f, 10f);
                DrawMinMaxFloat("渐变起点", m_MinFadeStart, m_MaxFadeStart, 0f, 2f);
                DrawMinMaxFloat("渐变终点", m_MinFadeEnd, m_MaxFadeEnd, 0f, 2f);
                EditorGUI.indentLevel--;
            }

            // ── Intensity Fade ──
            GUILayout.Space(6);
            m_FoldoutIntensityFade = EditorGUILayout.Foldout(m_FoldoutIntensityFade, "Intensity Fade 参数", true, EditorStyles.foldoutHeader);
            if (m_FoldoutIntensityFade)
            {
                EditorGUI.indentLevel++;
                DrawMinMaxFloat("渐变起点", m_MinIntensityFadeStart, m_MaxIntensityFadeStart, 0f, 2f);
                DrawMinMaxFloat("渐变终点", m_MinIntensityFadeEnd, m_MaxIntensityFadeEnd, 0f, 2f);
                EditorGUI.indentLevel--;
            }

            // ── Unified Action Buttons ──
            EditorGUI.indentLevel--;
            GUILayout.Space(10);
            EditorGUILayout.LabelField("快捷操作", EditorStyles.boldLabel);
            using (new EditorGUILayout.HorizontalScope())
            {
                var prevColor = GUI.backgroundColor;

                GUI.backgroundColor = new Color(0.6f, 0.9f, 0.6f);
                if (GUILayout.Button("Capture → Min"))
                {
                    serializedObject.Update();
                    foreach (Object t in targets)
                        ((ProjectorShadow)t).CaptureAsMin();
                    serializedObject.ApplyModifiedProperties();
                }

                GUI.backgroundColor = new Color(0.6f, 0.8f, 1.0f);
                if (GUILayout.Button("Capture → Max"))
                {
                    serializedObject.Update();
                    foreach (Object t in targets)
                        ((ProjectorShadow)t).CaptureAsMax();
                    serializedObject.ApplyModifiedProperties();
                }

                GUI.backgroundColor = new Color(0.9f, 0.9f, 0.9f);
                if (GUILayout.Button("Set Sharp"))
                {
                    serializedObject.Update();
                    foreach (Object t in targets)
                        ((ProjectorShadow)t).ApplyMinLinkValues();
                    serializedObject.ApplyModifiedProperties();
                }

                GUI.backgroundColor = new Color(1.0f, 0.85f, 0.6f);
                if (GUILayout.Button("Set Blur"))
                {
                    serializedObject.Update();
                    foreach (Object t in targets)
                        ((ProjectorShadow)t).ApplyMaxLinkValues();
                    serializedObject.ApplyModifiedProperties();
                }

                GUI.backgroundColor = prevColor;
            }
        });
    }

    private void DrawMinMaxFloat(string label, SerializedProperty minProp, SerializedProperty maxProp, float minLimit, float maxLimit)
    {
        EditorGUI.indentLevel++;
        EditorGUILayout.LabelField(label, EditorStyles.boldLabel);
        EditorGUI.indentLevel++;
        minProp.floatValue = EditorGUILayout.FloatField("Min", minProp.floatValue);
        maxProp.floatValue = EditorGUILayout.FloatField("Max", maxProp.floatValue);
        EditorGUI.indentLevel--;
        EditorGUI.indentLevel--;
    }

    private void DrawMinMaxInt(string label, SerializedProperty minProp, SerializedProperty maxProp, int minLimit, int maxLimit)
    {
        EditorGUI.indentLevel++;
        EditorGUILayout.LabelField(label, EditorStyles.boldLabel);
        EditorGUI.indentLevel++;
        minProp.intValue = EditorGUILayout.IntField("Min", minProp.intValue);
        maxProp.intValue = EditorGUILayout.IntField("Max", maxProp.intValue);
        EditorGUI.indentLevel--;
        EditorGUI.indentLevel--;
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
}


using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

[CustomEditor(typeof(Light))]
[CanEditMultipleObjects]
public class LightAdvanceEditor : LightEditor
{
    private bool m_CustomCommandBuffersShown = true;

    public override void OnInspectorGUI()
    {
        Light light = (Light)target;
        var addData = light.GetComponent<MTAdditionalLightData>();

        if (addData != null)
            DrawCustomInspector(addData);
        else
            base.OnInspectorGUI();

        DrawSpotLightRange();
        DrawShadowControllerGUI();
        DrawAdditionalLightDataGUI(addData);

        // 强制 Scene 视图重绘，确保 Gizmos 及时更新
        if (addData != null && addData.showGizmos)
            SceneView.RepaintAll();
    }

    private void DrawCustomInspector(MTAdditionalLightData addData)
    {
        Light light = (Light)target;
        serializedObject.Update();
        settings.Update();

        bool isSpotOnlyShadow = addData.CurrentLightType == MTLightType.SpotOnlyShadow
                             || addData.CurrentLightType == MTLightType.SpotVirtual;
        bool isDirectional = light.type == LightType.Directional && !isSpotOnlyShadow;
        bool isSpot = light.type == LightType.Spot && !isSpotOnlyShadow;
        bool isArea = (light.type == LightType.Rectangle || light.type == LightType.Disc) && !isSpotOnlyShadow;
        bool isCompletelyBaked = light.lightmapBakeType == LightmapBakeType.Baked;
        bool showRuntimeOptions = !isArea && !isCompletelyBaked;

        // === Type ===
        EditorGUI.BeginChangeCheck();
        MTLightType currentType = (MTLightType)EditorGUILayout.EnumPopup("Type", addData.CurrentLightType);
        if (EditorGUI.EndChangeCheck())
        {
            Undo.RecordObjects(new Object[] { light, addData }, "Change Light Type");
            addData.CurrentLightType = currentType;
            light.type = (currentType == MTLightType.SpotOnlyShadow || currentType == MTLightType.SpotVirtual)
                ? LightType.Directional
                : (LightType)(int)currentType;
            EditorUtility.SetDirty(addData);
            // 立即更新本帧其余 UI 的判断，并强制重绘 Inspector 和 Scene View
            isSpotOnlyShadow = addData.CurrentLightType == MTLightType.SpotOnlyShadow
                            || addData.CurrentLightType == MTLightType.SpotVirtual;
            isDirectional = light.type == LightType.Directional && !isSpotOnlyShadow;
            isSpot        = light.type == LightType.Spot && !isSpotOnlyShadow;
            Repaint();
            SceneView.RepaintAll();
        }

        EditorGUILayout.Space();

        // === Range ===
        if (isSpotOnlyShadow)
        {
            EditorGUI.BeginChangeCheck();
            float range = Mathf.Clamp(EditorGUILayout.FloatField("Range", addData.Range), 0.1f, 100f);
            if (EditorGUI.EndChangeCheck())
            {
                Undo.RecordObject(addData, "Change Virtual Light Range");
                addData.Range = range;
                EditorUtility.SetDirty(addData);
                SceneView.RepaintAll();
            }
        }
        else if (!isDirectional)
        {
            settings.DrawRange();
        }

        // === Spot Angle ===
        if (isSpotOnlyShadow)
        {
            EditorGUI.BeginChangeCheck();
            float spotAngle = EditorGUILayout.Slider("Spot Angle", addData.SpotAngle, 1f, 179f);
            if (EditorGUI.EndChangeCheck())
            {
                Undo.RecordObject(addData, "Change Virtual Light SpotAngle");
                addData.SpotAngle = spotAngle;
                EditorUtility.SetDirty(addData);
                SceneView.RepaintAll();
            }
        }
        else if (isSpot)
        {
            settings.DrawSpotAngle();
        }

        // === Area ===
        if (isArea)
            settings.DrawArea();

        // === Color ===
        settings.DrawColor();

        // === Gizmos (SpotOnlyShadow only) ===
        if (isSpotOnlyShadow)
        {
            EditorGUI.BeginChangeCheck();
            bool gizmos = EditorGUILayout.Toggle("Gizmos", addData.showGizmos);
            if (EditorGUI.EndChangeCheck())
            {
                Undo.RecordObject(addData, "Change Virtual Light Gizmos");
                addData.showGizmos = gizmos;
                EditorUtility.SetDirty(addData);
            }
        }

        EditorGUILayout.Space();

        // === Lightmapping ===
        if (!isArea)
            settings.DrawLightmapping();

        // === Intensity / Bounce ===
        settings.DrawIntensity();
        settings.DrawBounceIntensity();

        // === Shadows ===
        DrawShadows();

        // === Cookie ===
        if (showRuntimeOptions)
            settings.DrawCookie();

        if (isDirectional && showRuntimeOptions)
            settings.DrawCookieSize();

        // === 其余属性 ===
        settings.DrawHalo();
        settings.DrawFlare();
        settings.DrawRenderMode();
        settings.DrawCullingMask();
        settings.DrawRenderingLayerMask();

        EditorGUILayout.Space();
        if (SceneView.lastActiveSceneView != null && !SceneView.lastActiveSceneView.sceneLighting)
            EditorGUILayout.HelpBox("Lighting has been disabled in at least one Scene view.", MessageType.Warning);

        // === Command Buffers ===
        DrawCommandBuffers();

        settings.ApplyModifiedProperties();
        serializedObject.ApplyModifiedProperties();
    }

    private void DrawCommandBuffers()
    {
        if (targets.Length != 1)
            return;
        var light = target as Light;
        if (light == null)
            return;
        int count = light.commandBufferCount;
        if (count == 0)
            return;

        m_CustomCommandBuffersShown = GUILayout.Toggle(m_CustomCommandBuffersShown,
            new GUIContent(count + " command buffers"), EditorStyles.foldout);
        if (!m_CustomCommandBuffersShown)
            return;

        EditorGUI.indentLevel++;
        foreach (LightEvent le in (LightEvent[])System.Enum.GetValues(typeof(LightEvent)))
        {
            foreach (CommandBuffer cb in light.GetCommandBuffers(le))
            {
                using (new GUILayout.HorizontalScope())
                {
                    Rect rowRect = GUILayoutUtility.GetRect(GUIContent.none, EditorStyles.miniLabel);
                    rowRect.xMin += EditorGUI.indentLevel * 15;
                    var buttonSize = EditorStyles.miniButton.CalcSize(new GUIContent("-"));
                    Rect minusRect = new Rect(
                        rowRect.xMax - buttonSize.x,
                        rowRect.y + (int)(rowRect.height / 2 - buttonSize.y / 2),
                        buttonSize.x, buttonSize.y);
                    rowRect.xMax = minusRect.x;
                    GUI.Label(rowRect, string.Format("{0}: {1} ({2})", le, cb.name,
                        EditorUtility.FormatBytes(cb.sizeInBytes)), EditorStyles.miniLabel);
                    if (GUI.Button(minusRect, "-", EditorStyles.miniButton))
                    {
                        light.RemoveCommandBuffer(le, cb);
                        SceneView.RepaintAll();
                        GUIUtility.ExitGUI();
                    }
                }
            }
        }
        using (new GUILayout.HorizontalScope())
        {
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Remove all", EditorStyles.miniButton))
            {
                light.RemoveAllCommandBuffers();
                SceneView.RepaintAll();
            }
        }
        EditorGUI.indentLevel--;
    }

    private void DrawShadows()
    {
        Light light = (Light)target;
        bool isArea = light.type == LightType.Rectangle || light.type == LightType.Disc;
        bool isBakedOrMixed = light.lightmapBakeType != LightmapBakeType.Realtime;
        bool bakedShadowRadius = (light.type == LightType.Point || light.type == LightType.Spot) && isBakedOrMixed;
        bool bakedShadowAngle = light.type == LightType.Directional && isBakedOrMixed;
        bool showRuntimeShadows = !isArea && light.lightmapBakeType == LightmapBakeType.Realtime;

        settings.DrawShadowsType();

        EditorGUI.indentLevel++;
        if (bakedShadowRadius)
            settings.DrawBakedShadowRadius();
        if (bakedShadowAngle)
            settings.DrawBakedShadowAngle();
        if (showRuntimeShadows && light.shadows != LightShadows.None)
            settings.DrawRuntimeShadow();
        EditorGUI.indentLevel--;

        EditorGUILayout.Space();
    }

    private void DrawAdditionalLightDataGUI(MTAdditionalLightData addData)
    {
        GUILayout.Space(5);

        if (addData != null)
        {
            if (GUILayout.Button("移除灯光额外属性"))
            {
                foreach (Object obj in targets)
                {
                    Light lt = (Light)obj;
                    var comp = lt.GetComponent<MTAdditionalLightData>();
                    if (comp != null)
                        Undo.DestroyObjectImmediate(comp);
                }
            }
        }
        else
        {
            if (GUILayout.Button("添加灯光额外属性"))
            {
                foreach (Object obj in targets)
                {
                    Light lt = (Light)obj;
                    if (lt.GetComponent<MTAdditionalLightData>() != null)
                        continue;

                    var data = Undo.AddComponent<MTAdditionalLightData>(lt.gameObject);
                    switch (lt.type)
                    {
                        case LightType.Directional: data.CurrentLightType = MTLightType.Directional; break;
                        case LightType.Point:       data.CurrentLightType = MTLightType.Point;       break;
                        case LightType.Spot:        data.CurrentLightType = MTLightType.Spot;        break;
                        case LightType.Rectangle:
                        case LightType.Disc:        data.CurrentLightType = MTLightType.Area;        break;
                    }
                }
            }
        }
    }

    private void DrawShadowControllerGUI()
    {
        GUILayout.Space(10);
        bool hasShadow = FindObjectsOfType<ShadowController>().Any(s => s.enabled);
        string str = hasShadow
            ? "【当前使用的是球形灯光阴影】\nBias、NormalBias 参数当前面板不可调节，请在 ShadowController 面板中进行调节。"
            : "【当前使用的是Unity灯光阴影】\n如果需要使用球形阴影，请在GameObject->Light->ShadowController 进行创建，详细信息请看使用文档。";
        EditorGUILayout.HelpBox(str, MessageType.Warning);
    }

    private void DrawSpotLightRange()
    {
        Light light = (Light)target;
        var addData = light.GetComponent<MTAdditionalLightData>();

        if (addData != null && (addData.CurrentLightType == MTLightType.SpotOnlyShadow
                             || addData.CurrentLightType == MTLightType.SpotVirtual))
        {
            EditorGUI.BeginChangeCheck();
            float innerSpotAngle = EditorGUILayout.Slider("InnerSpotAngle", addData.InnerSpotAngle, 0f, 179f);
            if (EditorGUI.EndChangeCheck())
            {
                Undo.RecordObject(addData, "Change Virtual Light InnerSpotAngle");
                addData.InnerSpotAngle = Mathf.Min(innerSpotAngle, addData.SpotAngle);
                EditorUtility.SetDirty(addData);
            }
            return;
        }

        if (light.type == LightType.Spot)
            light.innerSpotAngle = EditorGUILayout.Slider("InnerSpotAngle", light.innerSpotAngle, 0f, 179f);
    }

    protected override void OnSceneGUI()
    {
        base.OnSceneGUI();

        Light light = (Light)target;
        var addData = light.GetComponent<MTAdditionalLightData>();

        if (addData == null || (addData.CurrentLightType != MTLightType.SpotOnlyShadow
                             && addData.CurrentLightType != MTLightType.SpotVirtual) || !addData.showGizmos)
            return;

        Transform t = light.transform;
        Vector3 pos = t.position;
        Vector3 forward = t.forward;
        float range = addData.Range;
        Vector3 outerCenter = pos + forward * range;
        float outerRadius = range * Mathf.Tan(Mathf.Deg2Rad * addData.SpotAngle / 2f);

        // 外锥体
        Handles.color = new Color(1f, 1f, 0.5f, 0.5f);
        Handles.DrawLine(pos, outerCenter + t.up    * outerRadius);
        Handles.DrawLine(pos, outerCenter - t.up    * outerRadius);
        Handles.DrawLine(pos, outerCenter + t.right * outerRadius);
        Handles.DrawLine(pos, outerCenter - t.right * outerRadius);
        Handles.DrawWireDisc(outerCenter, forward, outerRadius);

        // 内锥体
        if (addData.InnerSpotAngle > 0f)
        {
            Handles.color = new Color(1f, 0.8f, 0.3f, 0.3f);
            float innerRadius = range * Mathf.Tan(Mathf.Deg2Rad * addData.InnerSpotAngle / 2f);
            Handles.DrawWireDisc(outerCenter, forward, innerRadius);
        }
    }
}

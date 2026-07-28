using CustomShadow02;
using UnityEditor;
using UnityEngine;

internal static class CreateProjectorShadow
{
    [MenuItem("GameObject/Shadow/Projector Shadow", priority = 10)]
    public static void Create(MenuCommand menuCommand)
    {
        ProjectorShadow existing = Object.FindObjectOfType<ProjectorShadow>();
        if (existing != null)
        {
            Selection.activeObject = existing;
            EditorGUIUtility.PingObject(existing);
            return;
        }

        GameObject gameObject = new GameObject("Projector Shadow");
        GameObjectUtility.SetParentAndAlign(gameObject, menuCommand.context as GameObject);
        Undo.RegisterCreatedObjectUndo(gameObject, "Create Projector Shadow");
        gameObject.AddComponent<ProjectorShadow>();
        Selection.activeObject = gameObject;
    }
}

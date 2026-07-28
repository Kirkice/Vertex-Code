using UnityEngine;
using UnityEditor;

public class CreateShadowControllerV2Editor : MonoBehaviour
{
    [MenuItem("GameObject/Light/ShadowControllerV2", false, 10)]
    static public void LauchShadowControllerV2()
    {
        if(HaveController())
            return;
        
        GameObject controller = new GameObject();
        ShadowControllerV2 ctrl = controller.AddComponent<ShadowControllerV2>();
        controller.name = "Shadow Controller";
        controller.transform.position = new Vector3(0, 0, 0);
        controller.transform.eulerAngles = new Vector3(0, 0, 0);

        InitController(ctrl);
    }
    
    static private bool HaveController()
    {
        foreach (ShadowControllerV2 controller in FindObjectsOfType(typeof(ShadowControllerV2)))
            return true;

        return false;
    }

    static private void InitController(ShadowControllerV2 controller)
    {
        foreach (Light light in FindObjectsOfType(typeof(Light)))
        {
            if (light.type == LightType.Directional && light.shadows != LightShadows.None)
            {
                controller.targetLight = light;
                controller.InitController();
            }
        }
    }
}

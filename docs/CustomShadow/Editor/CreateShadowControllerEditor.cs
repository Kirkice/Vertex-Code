using UnityEngine;
using UnityEditor;

public class CreateShadowControllerEditor : MonoBehaviour
{
    [MenuItem("GameObject/Light/ShadowController", false, 10)]
    static public void LauchShadowController()
    {
        if(HaveController())
            return;
        
        GameObject controller = new GameObject();
        ShadowController ctrl = controller.AddComponent<ShadowController>();
        controller.name = "Shadow Controller";
        controller.transform.position = new Vector3(0, 0, 0);
        controller.transform.eulerAngles = new Vector3(0, 0, 0);

        InitController(ctrl);
    }
    
    static private bool HaveController()
    {
        foreach (ShadowController controller in FindObjectsOfType(typeof(ShadowController)))
            return true;

        return false;
    }

    static private void InitController(ShadowController controller)
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

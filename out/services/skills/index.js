"use strict";
/**
 * SkillsService - Manages skills/capabilities configuration
 * Ported from Zoo-Code with VertexAI naming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsService = exports.DEFAULT_SKILLS = void 0;
exports.DEFAULT_SKILLS = [
    { name: "read_file", description: "Read file contents", enabled: true, isCustom: false },
    { name: "write_file", description: "Write file contents", enabled: true, isCustom: false },
    { name: "list_files", description: "List files in directory", enabled: true, isCustom: false },
    { name: "search_files", description: "Search for patterns in files", enabled: true, isCustom: false },
    { name: "execute_command", description: "Execute terminal commands", enabled: true, isCustom: false },
    { name: "browser_action", description: "Browser automation", enabled: true, isCustom: false },
    { name: "mcp_tool", description: "Use MCP tools", enabled: true, isCustom: false },
];
class SkillsService {
    constructor(customSkills) {
        this.skills = [...exports.DEFAULT_SKILLS, ...(customSkills || [])];
    }
    getAllSkills() {
        return [...this.skills];
    }
    getEnabledSkills() {
        return this.skills.filter((skill) => skill.enabled);
    }
    getCustomSkills() {
        return this.skills.filter((skill) => skill.isCustom);
    }
    getSkill(name) {
        return this.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
    }
    isSkillEnabled(name) {
        const skill = this.getSkill(name);
        return skill?.enabled ?? false;
    }
    toggleSkill(name) {
        const skill = this.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (skill) {
            skill.enabled = !skill.enabled;
            return skill.enabled;
        }
        return false;
    }
    enableSkill(name) {
        const skill = this.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (skill) {
            skill.enabled = true;
        }
    }
    disableSkill(name) {
        const skill = this.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (skill) {
            skill.enabled = false;
        }
    }
    addSkill(skill) {
        const existing = this.skills.findIndex((s) => s.name.toLowerCase() === skill.name.toLowerCase());
        if (existing >= 0) {
            this.skills[existing] = { ...skill, isCustom: true };
        }
        else {
            this.skills.push({ ...skill, isCustom: true });
        }
    }
    removeSkill(name) {
        const index = this.skills.findIndex((s) => s.name.toLowerCase() === name.toLowerCase() && s.isCustom);
        if (index >= 0) {
            this.skills.splice(index, 1);
            return true;
        }
        return false;
    }
    toJSON() {
        return this.getCustomSkills();
    }
    static fromJSON(data) {
        return new SkillsService(data);
    }
}
exports.SkillsService = SkillsService;
//# sourceMappingURL=index.js.map
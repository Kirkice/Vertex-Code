/**
 * SkillsService - Manages skills/capabilities configuration
 * Ported from Zoo-Code with VertexAI naming
 */
export interface Skill {
    name: string;
    description: string;
    enabled: boolean;
    isCustom: boolean;
}
export declare const DEFAULT_SKILLS: Skill[];
export declare class SkillsService {
    private skills;
    constructor(customSkills?: Skill[]);
    getAllSkills(): Skill[];
    getEnabledSkills(): Skill[];
    getCustomSkills(): Skill[];
    getSkill(name: string): Skill | undefined;
    isSkillEnabled(name: string): boolean;
    toggleSkill(name: string): boolean;
    enableSkill(name: string): void;
    disableSkill(name: string): void;
    addSkill(skill: Omit<Skill, "isCustom">): void;
    removeSkill(name: string): boolean;
    toJSON(): Skill[];
    static fromJSON(data: Skill[]): SkillsService;
}
//# sourceMappingURL=index.d.ts.map
/**
 * Legacy wire format from find_skills: a flat map of slash-separated file
 * paths to file contents. New servers return a lazy XML index instead.
 */
export type SkillDirectoryMap = Record<string, string>;

/**
 * Legacy compatibility format: a map of skill names to their file maps.
 */
export type SkillsMap = Record<string, SkillDirectoryMap>;

export interface SkillIndex {
  name: string;
  description: string;
  skillDir: string;
  files: string[];
}

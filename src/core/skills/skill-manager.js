import * as UI from '../../ui.js';
import { EchoAlly } from '../../allies/index.js';
import { activateNoHeat, activateUltimateBarrage } from './void-skills.js';

/**
 * SkillManager - Quản lý cooldown, kích hoạt Void Skills
 * Extracted from game.js: voidSkills, selectedSkill, skill methods
 */
export class SkillManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.voidSkills = {
            noHeatMode: { active: false, timer: 0, cooldown: 120, lastUsed: -999, duration: 60 },
            ultimateBarrage: { cooldown: 120, lastUsed: -999 },
            permanentEcho: { acquired: false }
        };
        this.selectedSkill = null; // 'noHeatMode', 'permanentEcho', 'ultimateBarrage'
    }

    get isNoHeatActive() {
        return this.voidSkills.noHeatMode.active;
    }

    /**
     * Update skill cooldowns and UI
     * Extracted from game.js update() L376-L407
     */
    update(dt, game) {
        // VOID SKILL UPDATES & UI COOLDOWN (Triggered at 100s, unrelated to Behemoth)
        let skillText = null;
        if (this.selectedSkill) {
            const skill = this.voidSkills[this.selectedSkill];
            if (this.selectedSkill === 'noHeatMode') {
                if (skill.active) {
                    skillText = `ACTIVE (${Math.ceil(skill.timer)}s)`;
                } else {
                    const cooldownLeft = Math.max(0, skill.cooldown - (game.gameTime - skill.lastUsed));
                    if (cooldownLeft > 0) skillText = `Cooldown: ${Math.ceil(cooldownLeft)}s`;
                    else skillText = "🔥 NO HEAT";
                }
            } else if (this.selectedSkill === 'ultimateBarrage') {
                const skill = this.voidSkills[this.selectedSkill];
                const cooldownLeft = Math.max(0, skill.cooldown - (game.gameTime - skill.lastUsed));
                if (cooldownLeft > 0) skillText = `Cooldown: ${Math.ceil(cooldownLeft)}s`;
                else skillText = "🚀 BARRAGE";
            }
            if (skillText) UI.updateSkillButton(skillText);
        }

        if (this.voidSkills.noHeatMode.active) {
            this.voidSkills.noHeatMode.timer -= dt;
            if (this.voidSkills.noHeatMode.timer <= 0) {
                this.voidSkills.noHeatMode.active = false;
                game.ui.updateGameStatus("No Heat Mode Ended!");
            }
        }

        // VOID MODE 100s TRIGGER
        if (game.finalBossDefeated && game.getVoidTime() >= 100 && !this.selectedSkill && !game.isPaused) {
            this.showSelection(game);
        }
    }

    /**
     * Show skill selection modal
     * Extracted from game.js showVoidSkillSelection() L898-L906
     */
    showSelection(game) {
        game.isPaused = true;
        UI.showVoidSkillModal((skill) => {
            this.selectSkill(skill, game);
            UI.hideVoidSkillModal();
            game.isPaused = false;
            game.lastTime = performance.now();
        });
    }

    /**
     * Handle skill selection
     * Extracted from game.js selectVoidSkill() L908-L920
     */
    selectSkill(skill, game) {
        this.selectedSkill = skill;
        game.ui.updateGameStatus(`Skill Selected: ${skill}`);

        if (skill === 'permanentEcho') {
            this.voidSkills.permanentEcho.acquired = true;
            game.echoAlly2 = new EchoAlly();
            game.ui.updateGameStatus("Second Echo Ally Acquired!");
        }

        // Add skill button to HUD or Key listener
        UI.addSkillButton(skill, () => this.activate(game));
    }

    /**
     * Activate the selected skill
     * Extracted from game.js activateSkill() L922-L950
     */
    activate(game) {
        const skill = this.selectedSkill;
        if (!skill) return;

        if (skill === 'noHeatMode') {
            activateNoHeat(game, this.voidSkills.noHeatMode);
        } else if (skill === 'ultimateBarrage') {
            activateUltimateBarrage(game, this.voidSkills.ultimateBarrage);
        }
    }
}

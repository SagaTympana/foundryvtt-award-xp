"use strict";

import {registerSettings, settingsKey} from "./settings.js"
import {getSecondaryFormula, getSecondaryName, preparePcData} from "./systems.js"
import {getPcs} from "./util.js";


Hooks.once("init", () => {
	registerSettings()
	registerKeybindings();
})

Hooks.on("renderActorDirectory", async (app, _element, _context, options) => {
	// Only show the award xp button to the gm
	if (!game.user.isGM || !options.parts.includes("footer"))
		return

	const awardButton = document.createElement("button");
	awardButton.innerHTML = `<i class="fas fa-angle-double-up"></i> <span>${game.i18n.localize("award-xp.award-xp")}</span>`;
	awardButton.id = "awardXPButton";
	awardButton.addEventListener("click", () => {
		showAwardDialog()
	})
	const footer = app.element.querySelector("footer.directory-footer");
	footer?.append(awardButton);
})

function registerKeybindings() {
	game.keybindings.register(settingsKey, "showAwardDialog", {
		name: "award-xp.award-xp",
		onDown: showAwardDialog,
		restricted: true,
		precedence: -1,
	});
}

function filterCharacters(pc) {
	const characterFilter = game.settings.get(settingsKey, "character-filter")
	const isInFilter = characterFilter.includes(pc.id)
	if (game.settings.get(settingsKey, "character-filter-is-blacklist"))
		return !isInFilter
	else
		return isInFilter
}

async function showAwardDialog() {
	if (!game.user.isGM)
		return
	const secondaryFormula = getSecondaryFormula()
	let secondaryName = undefined
	if (secondaryFormula)
		secondaryName = getSecondaryName() ?? "[secondary name missing]"

	const characters = getPcs().filter(filterCharacters)
	const data = {secondaryName, characters, showSoloXp: game.settings.get(settingsKey, "character-solo-xp-input")}
	const content = await foundry.applications.handlebars.renderTemplate("modules/award-xp/templates/award_experience_dialog.html", data)
	await foundry.applications.api.Dialog.input({
		id: "award-xp",
		classes: ["standard-form"],
		window: {
			title: game.i18n.localize("award-xp.award-xp")
		},
		position: {
			width: game.settings.get(settingsKey, "character-solo-xp-input") ? 350 : 300
		},
		content: content,
		ok: {
			label: "award-xp.award-xp",
			callback: (event, button, dialog) => awardXP(event, button, dialog)
		},
		rejectClose: false,
	})
}

function onAwardDialogRendered(event, dialog) {
	//html.find("#award-xp-secondary-xp").keyup(onSecondaryChange)
}

function awardXP(event, button, dialog) {
	const form = button.closest("form");
	let charIds = Array.from(form.querySelectorAll(".award-xp-char-selector")).filter(selector => selector.checked).map(selector => selector.name)
	if (charIds.length === 0) {
		throw game.i18n.localize("award-xp.no-char-selected")
	}
	const pcs = preparePcData(game.actors.filter(actor => charIds.includes(actor.id)))
	const groupXp = parseInt(form.querySelector("#award-xp-xp").value) || 0;

	const divideXp = game.settings.get(settingsKey, "divide-xp");
	const charXp = divideXp ? Math.floor(groupXp / pcs.length) : groupXp;
	let soloXpInputs = Array.from(form.querySelectorAll(".award-xp-solo"))
	let soloXpPerCharacter = {}
	pcs.forEach(pc => {
		soloXpPerCharacter[pc.actor.id] = 0
		if (game.settings.get(settingsKey, "character-solo-xp-input")) {
			soloXpPerCharacter[pc.actor.id] = parseInt(soloXpInputs.find(input => input.name === `xp${pc.actor.id}`)?.value) || 0
		}
		pc.newXp = pc.xp + charXp + soloXpPerCharacter[pc.actor.id]
		const updateData = {}
		updateData[pc.xpAttribute] = pc.newXp
		pc.actor.update(updateData)
	})

	renderAwardedMessage(charXp, pcs, soloXpPerCharacter)
}

async function renderAwardedMessage(charXp, pcs, soloXpPerCharacter) {
	let message = {}
	message.content = await renderTemplate("modules/award-xp/templates/awarded_experience_message.html", {xp: charXp, characters: pcs.map(pc => {return {name: pc.actor.name, bonusXp: soloXpPerCharacter[pc.actor.id] > 0 ? soloXpPerCharacter[pc.actor.id] : undefined}})})
	ChatMessage.create(message)

	const levelups = pcs.filter(pc => pc.newXp >= pc.nextLevelXp)
	if (levelups.length > 0) {
		let message = {}
		message.content = await renderTemplate("modules/award-xp/templates/levelup_message.html", {characters: levelups.map(pc => pc.actor.name)})
		ChatMessage.create(message)
	}
}

function onSecondaryChange(event) {
	const secondaryValue = event.target.value.trim()
	const formula = getSecondaryFormula()
	const entry = formula.find(entry => secondaryValue == entry[0])
	if (entry) {
		const xp = entry[1]
		document.querySelector("#award-xp-xp").value = xp
	}
}

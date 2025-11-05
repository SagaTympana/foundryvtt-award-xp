export function getPcs() {
	return game.actors.filter(actor => actor.system.type === "character" || actor.system.type === "player" || actor.type === "Player Character").map(actor =>{return {id: actor.id, name: actor.name, image: actor.img}});	
}

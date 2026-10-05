class_name BattleBots
extends RefCounted
## Automatic players used to check the balance. Like a human they know the enemy only
## through Battle.contacts and never read enemy units.

enum Style {
	## Buys nothing and gives no orders.
	IDLE,
	## Sends everything straight at the objectives.
	RUSH,
	## Scouts first, shells what it sees, then moves in.
	RECON,
}

const THINK_INTERVAL := 1.0
## Combat units wait this far from an objective until it looks clear.
const STAGING_DISTANCE := 9.0
const OBSERVE_DISTANCE := 9.0
## A contact older than this no longer holds the attack back.
const FRESH_CONTACT := 25.0
const SAFE_STRIKE_MARGIN := 1.5

var style: Style
## Objective each of our units is assigned to, by unit id.
var _assigned: Dictionary[int, int] = {}
var _last_strike := -100.0
## When each objective was last shelled.
var _shelled: Dictionary[int, float] = {}


func _init(bot_style: Style) -> void:
	style = bot_style


static func play(seed_value: int, bot_style: Style, rules: BattleRules = null) -> Battle:
	var battle := Battle.new(seed_value, rules)
	var bot := BattleBots.new(bot_style)
	bot.deploy(battle)
	while battle.result == Battle.Result.ONGOING:
		bot.think(battle)
		battle.advance(THINK_INTERVAL)
	return battle


func deploy(battle: Battle) -> void:
	match style:
		Style.RUSH:
			battle.buy_unit(UnitKind.Type.RIFLE)
			battle.buy_unit(UnitKind.Type.RIFLE)
			battle.buy_unit(UnitKind.Type.APC)
		Style.RECON:
			battle.buy_unit(UnitKind.Type.SCOUT)
			battle.buy_unit(UnitKind.Type.RIFLE)
			battle.buy_unit(UnitKind.Type.APC)
	# Whatever is left goes into more riflemen, keeping one strike for the scouting player.
	var reserve := battle.rules.strike_cost if style == Style.RECON else 0.0
	while style != Style.IDLE and battle.funds >= UnitKind.COST[UnitKind.Type.RIFLE] + reserve:
		battle.buy_unit(UnitKind.Type.RIFLE)


func think(battle: Battle) -> void:
	if style == Style.IDLE:
		return
	# Shells come first: a squad is bought only with what is left after them.
	if style == Style.RECON:
		_shell(battle)
	if battle.arrivals.is_empty() and battle.can_buy(UnitKind.Type.RIFLE):
		battle.buy_unit(UnitKind.Type.RIFLE)

	var goal := _next_objective(battle)
	for unit in battle.units:
		if unit.side != BattleUnit.Side.PLAYER or not unit.is_on_map():
			continue
		if unit.order == BattleUnit.Order.RETREAT or _is_refitting(battle, unit):
			continue
		if unit.kind == UnitKind.Type.SCOUT:
			_scout(battle, unit, goal)
		else:
			_fight(battle, unit, goal)


## Pulls a unit that has lost half of its strength back to the base and keeps it
## there until it is nearly whole again. Returns true while the unit is out of action.
func _is_refitting(battle: Battle, unit: BattleUnit) -> bool:
	var share := float(unit.strength) / unit.max_strength()
	var base := BattleMap.cell_centre(battle.map.player_base)
	var at_base := unit.position.distance_to(base) <= battle.rules.refit_radius
	if at_base and share < 0.9:
		return true
	if share <= 0.5 and unit.target < 0:
		if not at_base:
			battle.order_retreat(unit.id)
		return true
	return false


## The objective to go for: the first one not yet ours, counting from our side of the map.
func _next_objective(battle: Battle) -> int:
	for objective in battle.map.objectives:
		if battle.owners[objective.index] != BattleUnit.Side.PLAYER:
			return objective.index
	return -1


func _scout(battle: Battle, unit: BattleUnit, goal: int) -> void:
	if goal < 0 or unit.is_moving() or _fresh_contacts_near(battle, unit.position, 12.0) > 0:
		return
	var spot := _stand_off(battle, goal, OBSERVE_DISTANCE)
	if unit.position.distance_to(spot) > 2.5:
		battle.order_move(unit.id, Vector2i(spot.floor()))


func _fight(battle: Battle, unit: BattleUnit, goal: int) -> void:
	# The first two units keep the first objective, later ones go on.
	if not _assigned.has(unit.id):
		_assigned[unit.id] = 0 if _assigned.size() < 2 else -1
	var objective: int = _assigned[unit.id]
	if objective < 0:
		objective = goal
	if objective < 0:
		return
	var centre := BattleMap.cell_centre(battle.map.objectives[objective].cell)
	var ours := battle.owners[objective] == BattleUnit.Side.PLAYER
	# Hold back only while shells are on their way to this objective.
	var wait := false
	if style == Style.RECON and not ours:
		for strike in battle.strikes:
			if strike.target.distance_to(centre) <= 7.0:
				wait = true
	if wait:
		var spot := _stand_off(battle, objective, STAGING_DISTANCE)
		if unit.order == BattleUnit.Order.CAPTURE:
			battle.order_hold(unit.id)
		if not unit.is_moving() and unit.position.distance_to(spot) > 2.5:
			battle.order_move(unit.id, Vector2i(spot.floor()))
	elif unit.order != BattleUnit.Order.CAPTURE or unit.objective != objective:
		battle.order_capture(unit.id, objective)


func _shell(battle: Battle) -> void:
	if not battle.can_strike() or battle.time - _last_strike < battle.rules.strike_delay + 2.0:
		return

	var danger := battle.rules.strike_radius + battle.rules.strike_scatter + SAFE_STRIKE_MARGIN
	for contact: Battle.Contact in battle.contacts.values():
		if not contact.visible or contact.error > 1.8:
			continue
		var safe := true
		for unit in battle.units:
			if unit.side == BattleUnit.Side.PLAYER and unit.is_on_map():
				if unit.position.distance_to(contact.position) < danger:
					safe = false
		if safe:
			battle.call_strike(contact.position)
			_last_strike = battle.time
			for objective in battle.map.objectives:
				var centre := BattleMap.cell_centre(objective.cell)
				if centre.distance_to(contact.position) <= 6.0:
					_shelled[objective.index] = battle.time + battle.rules.strike_delay
			return


func _fresh_contacts_near(battle: Battle, position: Vector2, distance: float) -> int:
	var count := 0
	for contact: Battle.Contact in battle.contacts.values():
		if battle.time - contact.last_seen > FRESH_CONTACT:
			continue
		if contact.position.distance_to(position) <= distance:
			count += 1
	return count


## A point this far from the objective on the line towards our base.
func _stand_off(battle: Battle, objective: int, distance: float) -> Vector2:
	var centre := BattleMap.cell_centre(battle.map.objectives[objective].cell)
	var base := BattleMap.cell_centre(battle.map.player_base)
	return centre + (base - centre).normalized() * distance

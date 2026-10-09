class_name BattleEnemyAI
extends RefCounted
## Decides what enemy units do. It gives the same orders a player could give and
## reacts only to objectives changing hands, never to hidden knowledge of the player.

const THINK_INTERVAL := 1.0

var _next_think := 0.0
var _next_reinforcement := -1.0
var _reinforcements := 0


func think(battle: Battle) -> void:
	if battle.time < _next_think:
		return
	_next_think = battle.time + THINK_INTERVAL
	if _next_reinforcement < 0.0:
		_next_reinforcement = battle.rules.enemy_reinforce_interval

	for unit in battle.units:
		if unit.side != BattleUnit.Side.ENEMY or not unit.is_on_map():
			continue
		# A unit in a firefight or pulling back is left alone.
		if unit.target >= 0 or unit.order == BattleUnit.Order.RETREAT:
			continue
		if unit.strength <= battle.rules.retreat_threshold * unit.max_strength():
			continue
		match unit.role:
			BattleUnit.Role.GARRISON:
				_hold_objective(battle, unit)
			BattleUnit.Role.PATROL:
				if not _counterattack(battle, unit):
					_patrol(battle, unit)
			BattleUnit.Role.RESERVE:
				_counterattack(battle, unit)

	if battle.time >= _next_reinforcement:
		# Reinforcements do not come like clockwork.
		_next_reinforcement += battle.rules.enemy_reinforce_interval * battle.random_range(0.7, 1.3)
		if battle.count_units(BattleUnit.Side.ENEMY) < battle.rules.enemy_unit_cap:
			_reinforcements += 1
			var kind := UnitKind.Type.APC if _reinforcements % 3 == 0 else UnitKind.Type.RIFLE
			var unit := battle.add_unit(BattleUnit.Side.ENEMY, kind, battle.map.enemy_base)
			unit.role = BattleUnit.Role.RESERVE


func _hold_objective(battle: Battle, unit: BattleUnit) -> void:
	var home := BattleMap.cell_centre(unit.home_cell)
	if unit.position.distance_to(home) > 0.8 * battle.map.unit and not unit.is_moving():
		battle.order_move(unit.id, unit.home_cell)


func _patrol(battle: Battle, unit: BattleUnit) -> void:
	if unit.patrol.is_empty() or unit.is_moving() or battle.time < unit.wait_until:
		return
	unit.patrol_index = (unit.patrol_index + 1) % unit.patrol.size()
	battle.order_move(unit.id, unit.patrol[unit.patrol_index])
	# Long enough at each stop to scout the hex it has come to.
	unit.wait_until = battle.time + 45.0


## Sends the unit to the nearest objective the player has held long enough.
func _counterattack(battle: Battle, unit: BattleUnit) -> bool:
	var best := -1
	var best_distance := INF
	for objective in battle.map.objectives:
		var i := objective.index
		if battle.owners[i] != BattleUnit.Side.PLAYER:
			continue
		if battle.time - battle.taken_at[i] < battle.rules.counterattack_delay:
			continue
		var distance := unit.position.distance_to(BattleMap.cell_centre(objective.cell))
		if distance < best_distance:
			best_distance = distance
			best = i
	if best < 0:
		return false
	if unit.order != BattleUnit.Order.CAPTURE or unit.objective != best:
		battle.order_capture(unit.id, best)
	return true

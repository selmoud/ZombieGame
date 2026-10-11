class_name BattleEnemyAI
extends RefCounted
## Decides what enemy units do. It gives the same orders a player could give and
## knows of the player only what its own units have seen: sightings that it keeps
## for a while and that grow stale, exactly like the player's contact marks.

const THINK_INTERVAL := 1.0
## A sighting older than this no longer draws units; an even older one is forgotten.
const FRESH := 20.0
const FORGET := 60.0
## Free units within this distance of a fresh sighting move to engage it.
const ENGAGE_DISTANCE := 13.0
## They stop this far from where the player was seen: inside rifle range.
const STAND_OFF := 4.5
## An ambush party falls back when the player's strength close by is this many times that
## of the enemy units around it.
const OUTNUMBERED := 2.0
const THREAT_RADIUS := 8.0
const SUPPORT_RADIUS := 6.0
## Ambush posts lie this many hex widths in front of the objective, to each side
## of the line the player is expected to come along.
const POST_DISTANCES: Array[float] = [1.6, 1.0]
const POST_SPREAD := 0.55

var _next_think := 0.0
var _next_reinforcement := -1.0
var _reinforcements := 0
## Player unit id -> {"position": Vector2, "time": float, "strength": int}.
var _sightings: Dictionary[int, Dictionary] = {}
## Unit id -> the sighted player unit it has gone to engage.
var _engaging: Dictionary[int, int] = {}
## Unit id -> the post it has turned to face from, so that it turns only once.
var _faced: Dictionary[int, Vector2i] = {}
## The objective the ambush posts were last laid out for.
var _posted_for := -2


func think(battle: Battle) -> void:
	if battle.time < _next_think:
		return
	_next_think = battle.time + THINK_INTERVAL
	if _next_reinforcement < 0.0:
		_next_reinforcement = battle.rules.enemy_reinforce_interval
		_pick_ambushers(battle)

	_remember(battle)
	var front := battle.active_objective(BattleUnit.Side.PLAYER)
	if front != _posted_for:
		_posted_for = front
		_lay_ambushes(battle, front)

	for unit in battle.units:
		if unit.side != BattleUnit.Side.ENEMY or not unit.is_on_map():
			continue
		if _fall_back_if_outnumbered(battle, unit):
			continue
		# A unit in a firefight or pulling back is left alone.
		if unit.target >= 0 or unit.order == BattleUnit.Order.RETREAT:
			continue
		if unit.strength <= battle.rules.retreat_threshold * unit.max_strength():
			continue
		match unit.role:
			BattleUnit.Role.GARRISON:
				_hold_post(battle, unit)
			BattleUnit.Role.AMBUSH:
				if not _engage(battle, unit):
					_hold_post(battle, unit)
			BattleUnit.Role.RESERVE:
				if not _engage(battle, unit):
					_counterattack(battle, unit)

	if battle.time >= _next_reinforcement:
		# Reinforcements do not come like clockwork.
		_next_reinforcement += battle.rules.enemy_reinforce_interval * battle.random_range(0.7, 1.3)
		if battle.count_units(BattleUnit.Side.ENEMY) < battle.rules.enemy_unit_cap:
			_reinforcements += 1
			var kind := UnitKind.Type.APC if _reinforcements % 3 == 0 else UnitKind.Type.RIFLE
			var unit := battle.add_unit(BattleUnit.Side.ENEMY, kind, battle.map.enemy_base)
			unit.role = BattleUnit.Role.RESERVE


# --- What the enemy knows -----------------------------------------------------

func _remember(battle: Battle) -> void:
	for unit_id in battle.seen_by(BattleUnit.Side.ENEMY):
		var seen := battle.units[unit_id]
		_sightings[unit_id] = {"position": seen.position, "time": battle.time, "strength": seen.strength}
	for unit_id: int in _sightings.keys():
		if battle.time - _sightings[unit_id].time > FORGET:
			_sightings.erase(unit_id)


## Strength of the player units seen recently within the radius of the point.
func _threat_near(battle: Battle, point: Vector2, radius: float) -> int:
	var total := 0
	for sighting: Dictionary in _sightings.values():
		if battle.time - sighting.time <= FRESH and point.distance_to(sighting.position) <= radius:
			total += sighting.strength
	return total


# --- Posts and ambushes -------------------------------------------------------

## The patrol and one squad from the deepest objective lie in ambush instead of
## waiting on an objective.
func _pick_ambushers(battle: Battle) -> void:
	var deepest := battle.map.objectives.size() - 1
	var taken := false
	for unit in battle.units:
		if unit.side != BattleUnit.Side.ENEMY:
			continue
		if unit.role == BattleUnit.Role.PATROL:
			unit.role = BattleUnit.Role.AMBUSH
		elif not taken and unit.role == BattleUnit.Role.GARRISON and unit.guard == deepest \
				and unit.kind == UnitKind.Type.RIFLE:
			unit.role = BattleUnit.Role.AMBUSH
			taken = true


## Where the player is expected to come from when he goes for the objective:
## from the one before it in the chain, or from his base.
func _approach(battle: Battle, objective: int) -> Vector2:
	var centre := BattleMap.cell_centre(battle.map.objectives[objective].cell)
	var from := BattleMap.cell_centre(battle.map.player_base)
	if objective > 0:
		from = BattleMap.cell_centre(battle.map.objectives[objective - 1].cell)
	return (from - centre).normalized()


## Sends the ambushers to posts among the houses in front of the objective the
## player has to take next.
func _lay_ambushes(battle: Battle, front: int) -> void:
	if front < 0:
		return
	var map := battle.map
	var centre := BattleMap.cell_centre(map.objectives[front].cell)
	var approach := _approach(battle, front)
	var width := HexGrid.SQRT3 * battle.hex_size()
	var posts: Array[Vector2i] = []
	for side: float in [1.0, -1.0]:
		for distance in POST_DISTANCES:
			var spot := centre + approach.rotated(POST_SPREAD * side) * distance * width
			var cell := map.nearest_terrain(Vector2i(spot.floor()), Terrain.Type.TOWN, roundi(2.0 * map.unit))
			if map.get_terrain(cell) == Terrain.Type.TOWN:
				posts.append(cell)
				break
	var next := 0
	for unit in battle.units:
		if unit.side != BattleUnit.Side.ENEMY or not unit.alive or unit.role != BattleUnit.Role.AMBUSH:
			continue
		unit.guard = front
		if next < posts.size():
			unit.home_cell = posts[next]
			next += 1
		else:
			# No room for an ambush here: strengthen the objective itself.
			unit.home_cell = map.nearest_terrain(map.objectives[front].cell, Terrain.Type.TOWN, roundi(4.0 * map.unit))
		_engaging.erase(unit.id)


## Keeps the unit at its post and, once there, turns it to face the way the
## player is expected to come, so that side is scouted first.
func _hold_post(battle: Battle, unit: BattleUnit) -> void:
	if unit.home_cell.x < 0:
		return
	var home := BattleMap.cell_centre(unit.home_cell)
	if unit.position.distance_to(home) > 0.8 * battle.map.unit:
		if not unit.is_moving():
			battle.order_move(unit.id, unit.home_cell)
		return
	if unit.guard >= 0 and _faced.get(unit.id, Vector2i(-1, -1)) != unit.home_cell:
		_faced[unit.id] = unit.home_cell
		battle.order_face(unit.id, unit.position + _approach(battle, unit.guard) * 10.0)


# --- Reacting to the player ---------------------------------------------------

## Moves a free unit to within rifle range of a player unit seen nearby and stops
## it there among houses. Returns true while the unit is busy with that.
func _engage(battle: Battle, unit: BattleUnit) -> bool:
	var u := battle.map.unit
	var best := -1
	var best_distance := ENGAGE_DISTANCE * u
	for unit_id: int in _sightings:
		var sighting := _sightings[unit_id]
		if battle.time - sighting.time > FRESH:
			continue
		var distance := unit.position.distance_to(sighting.position)
		if distance < best_distance:
			best_distance = distance
			best = unit_id
	if best < 0:
		_engaging.erase(unit.id)
		return false
	if best_distance <= UnitKind.WEAPON_RANGE[unit.kind] * u * 0.9:
		# Close enough already: stand still, scout and shoot.
		if unit.is_moving():
			battle.order_hold(unit.id)
		_engaging[unit.id] = best
		return true
	if _engaging.get(unit.id, -1) == best and unit.is_moving():
		return true
	var seen_at: Vector2 = _sightings[best].position
	var spot := seen_at + (unit.position - seen_at).normalized() * STAND_OFF * u
	var cell := Vector2i(spot.floor())
	if unit.mover() == Terrain.Mover.INFANTRY:
		cell = battle.map.nearest_terrain(cell, Terrain.Type.TOWN, roundi(1.5 * u))
	if battle.order_move(unit.id, cell):
		# It knows the player is there, so it does not stop at the first glimpse of him.
		unit.push = true
		_engaging[unit.id] = best
		return true
	return false


## An ambush party facing far more than it and its neighbours can handle gives up
## its forward post and joins the garrison of the objective it was screening.
## Garrisons themselves stay: an objective is not given up without a fight.
func _fall_back_if_outnumbered(battle: Battle, unit: BattleUnit) -> bool:
	if unit.role != BattleUnit.Role.AMBUSH or unit.guard < 0:
		return false
	var u := battle.map.unit
	var threat := _threat_near(battle, unit.position, THREAT_RADIUS * u)
	if threat == 0:
		return false
	var friends := 0
	for other in battle.units:
		if other.side == unit.side and other.is_on_map() \
				and other.position.distance_to(unit.position) <= SUPPORT_RADIUS * u:
			friends += other.strength
	if threat < OUTNUMBERED * friends:
		return false
	unit.role = BattleUnit.Role.GARRISON
	var around := battle.map.objectives[unit.guard].cell
	var shift := Vector2i(roundi(battle.random_range(-2.0, 2.0) * u), roundi(battle.random_range(-2.0, 2.0) * u))
	unit.home_cell = battle.map.nearest_terrain(around + shift, Terrain.Type.TOWN, roundi(4.0 * u))
	_engaging.erase(unit.id)
	battle.order_move(unit.id, unit.home_cell)
	unit.push = true
	return true


## Sends the unit to take back the last objective the player holds, once the
## player has held it long enough.
func _counterattack(battle: Battle, unit: BattleUnit) -> bool:
	var best := battle.active_objective(BattleUnit.Side.ENEMY)
	if best < 0 or battle.time - battle.taken_at[best] < battle.rules.counterattack_delay:
		return false
	if unit.order != BattleUnit.Order.CAPTURE or unit.objective != best:
		battle.order_capture(unit.id, best)
	return true

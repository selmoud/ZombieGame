class_name Battle
extends RefCounted
## One mission: the whole state and the rules that advance it. No nodes and no
## rendering, so a mission can be played from a test or by an automatic player.
##
## The player's side never reads enemy units directly: everything it may know
## about the enemy is in `contacts` and `events`.

enum Result { ONGOING, WON, LOST }

const STEP := 0.1
const NO_OWNER := -1
const REPORT_COOLDOWN := 12.0
## Reports that would otherwise flood the radio during a long firefight.
const SLOW_REPORTS: Dictionary[StringName, float] = {&"under_fire": 40.0}
## A unit that fired this recently is easier to spot.
const MUZZLE_FLASH_TIME := 2.0
const MUZZLE_FLASH_BONUS := 1.5
## A contact is identified when seen closer than this share of the sight range.
const IDENTIFY_RATIO := 0.75
const EMBARK_DISTANCE := 1.3
const CALL_SIGNS: PackedStringArray = [
	"Альфа", "Браво", "Вега", "Гранит", "Дельта", "Ельник",
	"Заря", "Искра", "Кедр", "Луч", "Молот", "Орёл",
]


## What the player knows about one enemy unit.
class Contact:
	var unit_id: int
	## Estimated position; off by up to `error` cells from the real one.
	var position: Vector2
	## UnitKind.Type, or -1 while the contact is not identified.
	var kind := -1
	var error := 0.0
	var last_seen := 0.0
	var visible := false
	var offset := Vector2.ZERO
	var offset_at := -100.0


class Strike:
	var target: Vector2
	var lands_at: float


class Arrival:
	var kind: UnitKind.Type
	var at: float


var map: BattleMap
var rules: BattleRules
var time := 0.0
var units: Array[BattleUnit] = []
## Owner of each objective: a BattleUnit.Side or NO_OWNER.
var owners := PackedInt32Array()
## Progress of the capture under way at each objective, 0..1.
var capture_progress := PackedFloat32Array()
var capture_side := PackedInt32Array()
## When the current owner took each objective.
var taken_at := PackedFloat32Array()
var funds := 0.0
var contacts: Dictionary[int, Contact] = {}
var strikes: Array[Strike] = []
var arrivals: Array[Arrival] = []
## Radio log: dictionaries with `time`, `kind` and details. Only grows.
var events: Array[Dictionary] = []
## How long the player has been holding enough objectives without a break.
var hold_time := 0.0
var result := Result.ONGOING

var _rng := RandomNumberGenerator.new()
var _accumulator := 0.0
var _ai := BattleEnemyAI.new()
## For each side: enemy unit id -> {"ratio": float, "observer": int}.
var _visible: Array[Dictionary] = [{}, {}]
var _tick_count := 0


func _init(seed_value: int, battle_rules: BattleRules = null, battle_map: BattleMap = null) -> void:
	rules = battle_rules if battle_rules != null else BattleRules.new()
	_rng.seed = seed_value
	if battle_map != null:
		map = battle_map
	else:
		map = MapLibrary.create_valley()
		MapLibrary.place_valley_enemy(self, _rng)
	funds = rules.start_funds
	var count := map.objectives.size()
	owners.resize(count)
	owners.fill(BattleUnit.Side.ENEMY)
	capture_progress.resize(count)
	capture_side.resize(count)
	capture_side.fill(NO_OWNER)
	taken_at.resize(count)


func add_unit(side: BattleUnit.Side, kind: UnitKind.Type, cell: Vector2i) -> BattleUnit:
	var unit := BattleUnit.new()
	unit.id = units.size()
	unit.side = side
	unit.kind = kind
	unit.strength = UnitKind.STRENGTH[kind]
	var free := map.nearest_passable(cell, unit.mover())
	unit.position = BattleMap.cell_centre(free if free.x >= 0 else cell)
	if side == BattleUnit.Side.PLAYER:
		var number := count_units(side, false)
		unit.call_sign = CALL_SIGNS[number % CALL_SIGNS.size()]
		if number >= CALL_SIGNS.size():
			unit.call_sign += "-%d" % (number / CALL_SIGNS.size() + 1)
	units.append(unit)
	return unit


func get_unit(id: int) -> BattleUnit:
	return units[id] if id >= 0 and id < units.size() else null


func count_units(side: BattleUnit.Side, alive_only: bool = true) -> int:
	var count := 0
	for unit in units:
		if unit.side == side and (unit.alive or not alive_only):
			count += 1
	return count


func count_held(side: int) -> int:
	var count := 0
	for owner in owners:
		if owner == side:
			count += 1
	return count


func is_seen_by(side: BattleUnit.Side, unit_id: int) -> bool:
	return _visible[side].has(unit_id)


## Random number from the mission's own generator, so a seed replays the same mission.
func random_range(from: float, to: float) -> float:
	return _rng.randf_range(from, to)


func base_of(side: BattleUnit.Side) -> Vector2i:
	return map.player_base if side == BattleUnit.Side.PLAYER else map.enemy_base


# --- Orders -----------------------------------------------------------------

func order_move(unit_id: int, cell: Vector2i) -> bool:
	var unit := get_unit(unit_id)
	if unit == null or not unit.is_on_map() or not _set_path(unit, cell):
		return false
	unit.order = BattleUnit.Order.MOVE
	unit.objective = -1
	unit.embark_target = -1
	unit.push = _is_enemy_close(unit)
	return true


func order_capture(unit_id: int, objective: int) -> bool:
	var unit := get_unit(unit_id)
	if unit == null or not unit.is_on_map() or objective < 0 or objective >= map.objectives.size():
		return false
	if not _set_path(unit, map.objectives[objective].cell):
		return false
	unit.order = BattleUnit.Order.CAPTURE
	unit.objective = objective
	unit.embark_target = -1
	return true


func order_retreat(unit_id: int) -> bool:
	var unit := get_unit(unit_id)
	if unit == null or not unit.is_on_map() or not _set_path(unit, base_of(unit.side)):
		return false
	unit.order = BattleUnit.Order.RETREAT
	unit.objective = -1
	unit.embark_target = -1
	return true


func order_hold(unit_id: int) -> bool:
	var unit := get_unit(unit_id)
	if unit == null or not unit.is_on_map():
		return false
	_stop(unit)
	return true


func order_embark(unit_id: int, carrier_id: int) -> bool:
	var unit := get_unit(unit_id)
	var carrier := get_unit(carrier_id)
	if unit == null or carrier == null or not unit.is_on_map() or not carrier.is_on_map():
		return false
	if unit.side != carrier.side or unit.mover() != Terrain.Mover.INFANTRY:
		return false
	if UnitKind.CAPACITY[carrier.kind] == 0 or carrier.passenger >= 0:
		return false
	_stop(unit)
	unit.order = BattleUnit.Order.EMBARK
	unit.embark_target = carrier_id
	_set_path(unit, Vector2i(carrier.position.floor()))
	return true


func order_disembark(carrier_id: int) -> bool:
	var carrier := get_unit(carrier_id)
	if carrier == null or not carrier.is_on_map() or carrier.passenger < 0:
		return false
	# Next to the carrier rather than under it, so both symbols stay readable.
	var at := Vector2i(carrier.position.floor())
	var cell := Vector2i(-1, -1)
	for step: Vector2i in [Vector2i.DOWN, Vector2i.UP, Vector2i.LEFT, Vector2i.RIGHT]:
		if map.is_passable(at + step * 2, Terrain.Mover.INFANTRY):
			cell = at + step * 2
			break
	if cell.x < 0:
		cell = map.nearest_passable(at, Terrain.Mover.INFANTRY)
	if cell.x < 0:
		return false
	var passenger := units[carrier.passenger]
	passenger.carrier = -1
	passenger.position = BattleMap.cell_centre(cell)
	carrier.passenger = -1
	_stop(passenger)
	_report(&"disembarked", passenger, {"carrier": carrier.id})
	return true


func can_buy(kind: UnitKind.Type) -> bool:
	if result != Result.ONGOING or funds < UnitKind.COST[kind]:
		return false
	return count_units(BattleUnit.Side.PLAYER) + arrivals.size() < rules.max_units


## Units bought before the mission starts arrive at once, later ones after a delay.
func buy_unit(kind: UnitKind.Type) -> bool:
	if not can_buy(kind):
		return false
	funds -= UnitKind.COST[kind]
	if time <= 0.0:
		_spawn_player_unit(kind)
		return true
	var arrival := Arrival.new()
	arrival.kind = kind
	arrival.at = time + rules.arrival_delay
	arrivals.append(arrival)
	return true


func can_strike() -> bool:
	return result == Result.ONGOING and funds >= rules.strike_cost


func call_strike(target: Vector2) -> bool:
	if not can_strike():
		return false
	funds -= rules.strike_cost
	var strike := Strike.new()
	strike.target = target
	strike.lands_at = time + rules.strike_delay
	strikes.append(strike)
	_report(&"strike_called", null, {"position": target})
	return true


# --- Time -------------------------------------------------------------------

func advance(delta: float) -> void:
	_accumulator += delta
	while _accumulator >= STEP and result == Result.ONGOING:
		_accumulator -= STEP
		_tick()
	if result != Result.ONGOING:
		_accumulator = 0.0


func _tick() -> void:
	time += STEP
	_tick_count += 1
	_process_arrivals()
	_update_sight()
	_ai.think(self)
	_move_units()
	_fight()
	_process_strikes()
	_refit_units()
	_update_objectives()
	_check_result()


func _process_arrivals() -> void:
	for i in range(arrivals.size() - 1, -1, -1):
		if arrivals[i].at <= time:
			var unit := _spawn_player_unit(arrivals[i].kind)
			arrivals.remove_at(i)
			_report(&"arrived_reinforcement", unit)


func _spawn_player_unit(kind: UnitKind.Type) -> BattleUnit:
	# Line arrivals up north and south of the base so their symbols and call signs
	# do not sit on top of each other.
	var index := count_units(BattleUnit.Side.PLAYER, false) % 7
	var row := (index + 1) / 2 * (1 if index % 2 == 1 else -1)
	return add_unit(BattleUnit.Side.PLAYER, kind, map.player_base + Vector2i(0, row * 3))


# --- Observation ------------------------------------------------------------

func _update_sight() -> void:
	_visible[0].clear()
	_visible[1].clear()
	for observer in units:
		if not observer.is_on_map():
			continue
		var sight := UnitKind.SIGHT[observer.kind] * Terrain.SIGHT[map.terrain_at(observer.position)]
		for other in units:
			if other.side == observer.side or not other.is_on_map():
				continue
			var reach := (
				sight * UnitKind.VISIBILITY[other.kind]
				* Terrain.CONCEALMENT[map.terrain_at(other.position)]
			)
			if time - other.fired_at < MUZZLE_FLASH_TIME:
				reach *= MUZZLE_FLASH_BONUS
			var distance := observer.position.distance_to(other.position)
			if distance > reach:
				continue
			# A scout's report counts as closer, so it wins over a rifleman at the same range.
			var ratio := distance / reach * UnitKind.REPORT_ERROR[observer.kind]
			var seen: Dictionary = _visible[observer.side]
			if not seen.has(other.id) or ratio < seen[other.id].ratio:
				seen[other.id] = {"ratio": ratio, "observer": observer.id}
	_update_contacts()


func _update_contacts() -> void:
	var seen: Dictionary = _visible[BattleUnit.Side.PLAYER]
	for unit_id: int in seen:
		var enemy := units[unit_id]
		var observer := units[seen[unit_id].observer as int]
		var ratio: float = seen[unit_id].ratio
		var contact: Contact = contacts.get(unit_id)
		var is_news := contact == null or (not contact.visible and time - contact.last_seen > 10.0)
		if contact == null:
			contact = Contact.new()
			contact.unit_id = unit_id
			contacts[unit_id] = contact
		contact.visible = true
		contact.last_seen = time
		contact.error = maxf(0.3, ratio * rules.contact_error)
		if ratio <= IDENTIFY_RATIO:
			contact.kind = enemy.kind
		if time - contact.offset_at > 4.0:
			contact.offset = Vector2.from_angle(_rng.randf() * TAU) * _rng.randf()
			contact.offset_at = time
		contact.position = enemy.position + contact.offset * contact.error
		if is_news:
			_report(&"contact", observer, {"position": contact.position, "contact_kind": contact.kind})

	for unit_id: int in contacts.keys():
		if seen.has(unit_id):
			continue
		var contact := contacts[unit_id]
		contact.visible = false
		if time - contact.last_seen > rules.contact_fade:
			contacts.erase(unit_id)


func _is_enemy_close(unit: BattleUnit) -> bool:
	var limit := UnitKind.HALT_DISTANCE[unit.kind]
	for unit_id: int in _visible[unit.side]:
		if unit.position.distance_to(units[unit_id].position) <= limit:
			return true
	return false


# --- Movement ---------------------------------------------------------------

func _set_path(unit: BattleUnit, cell: Vector2i) -> bool:
	var mover := unit.mover()
	var from := Vector2i(unit.position.floor())
	var to := map.nearest_passable(cell, mover)
	if to.x < 0:
		return false
	if from == to:
		unit.path = PackedVector2Array()
		unit.path_index = 0
		return true
	var path := map.find_path(from, to, mover)
	if path.is_empty():
		return false
	unit.path = path
	unit.path_index = 0
	return true


func _stop(unit: BattleUnit) -> void:
	unit.order = BattleUnit.Order.HOLD
	unit.path = PackedVector2Array()
	unit.path_index = 0
	unit.objective = -1
	unit.embark_target = -1
	unit.push = false


func _move_units() -> void:
	for unit in units:
		if not unit.is_on_map():
			continue
		match unit.order:
			BattleUnit.Order.EMBARK:
				if not _approach_carrier(unit):
					continue
			BattleUnit.Order.MOVE:
				if not unit.push and _is_enemy_close(unit):
					_stop(unit)
					_report(&"halted", unit)
					continue
			BattleUnit.Order.CAPTURE:
				if _is_enemy_close(unit):
					continue
		if not unit.is_moving():
			continue
		_step(unit)
		if unit.passenger >= 0:
			units[unit.passenger].position = unit.position
		if unit.is_moving():
			continue
		match unit.order:
			BattleUnit.Order.MOVE:
				_stop(unit)
				_report(&"arrived", unit)
			BattleUnit.Order.RETREAT:
				_stop(unit)


## Returns false when the unit has boarded or the order no longer makes sense.
func _approach_carrier(unit: BattleUnit) -> bool:
	var carrier := get_unit(unit.embark_target)
	if carrier == null or not carrier.is_on_map() or carrier.passenger >= 0:
		_stop(unit)
		return false
	if unit.position.distance_to(carrier.position) <= EMBARK_DISTANCE:
		_stop(unit)
		unit.carrier = carrier.id
		unit.position = carrier.position
		unit.target = -1
		carrier.passenger = unit.id
		_report(&"embarked", unit, {"carrier": carrier.id})
		return false
	# The carrier may be moving: follow it.
	if not unit.is_moving() or _tick_count % 10 == 0:
		_set_path(unit, Vector2i(carrier.position.floor()))
	return true


func _step(unit: BattleUnit) -> void:
	var terrain_speed := Terrain.speed(map.terrain_at(unit.position), unit.mover())
	var remaining := UnitKind.SPEED[unit.kind] * maxf(terrain_speed, 0.3) * STEP
	while remaining > 0.0 and unit.is_moving():
		var to := unit.path[unit.path_index]
		var distance := unit.position.distance_to(to)
		if distance <= remaining:
			unit.position = to
			unit.path_index += 1
			remaining -= distance
		else:
			unit.position += (to - unit.position) / distance * remaining
			remaining = 0.0


# --- Combat -----------------------------------------------------------------

func _fight() -> void:
	for unit in units:
		unit.target = -1
		if not unit.is_on_map():
			continue
		var best := -1
		var best_distance := UnitKind.WEAPON_RANGE[unit.kind]
		for unit_id: int in _visible[unit.side]:
			var distance := unit.position.distance_to(units[unit_id].position)
			if distance <= best_distance:
				best_distance = distance
				best = unit_id
		if best < 0:
			continue
		var enemy := units[best]
		unit.target = best
		unit.fired_at = time
		var power := 0.4 + 0.6 * unit.strength / unit.max_strength()
		enemy.damage += (
			UnitKind.FIREPOWER[unit.kind] * power * rules.damage_rate * STEP
			* Terrain.COVER[map.terrain_at(enemy.position)] * UnitKind.ARMOUR[enemy.kind]
		)
		enemy.hit_at = time
		_report(&"under_fire", enemy, {"position": enemy.position})

	for unit in units:
		if unit.is_on_map() and unit.damage >= 1.0:
			var losses := int(unit.damage)
			unit.damage -= losses
			_hurt(unit, losses)


func _hurt(unit: BattleUnit, losses: int) -> void:
	var was_above_half := unit.strength * 2 > unit.max_strength()
	unit.strength = maxi(unit.strength - losses, 0)
	if unit.strength == 0:
		_destroy(unit)
		return
	if was_above_half and unit.strength * 2 <= unit.max_strength():
		_report(&"casualties", unit, {"strength": unit.strength})
	var weak := unit.strength <= rules.retreat_threshold * unit.max_strength()
	if weak and unit.order != BattleUnit.Order.RETREAT and order_retreat(unit.id):
		_report(&"retreating", unit, {"strength": unit.strength})


func _destroy(unit: BattleUnit) -> void:
	unit.alive = false
	unit.path = PackedVector2Array()
	if unit.passenger >= 0:
		# The squad bails out of the burning carrier and loses half of its men.
		var passenger := units[unit.passenger]
		unit.passenger = -1
		passenger.carrier = -1
		passenger.position = unit.position
		_hurt(passenger, passenger.strength / 2)
	if unit.side == BattleUnit.Side.PLAYER:
		_report(&"unit_lost", unit, {"position": unit.position})
	elif contacts.has(unit.id):
		if contacts[unit.id].visible:
			_report(&"enemy_destroyed", null, {"position": unit.position})
		contacts.erase(unit.id)


func _process_strikes() -> void:
	for i in range(strikes.size() - 1, -1, -1):
		var strike := strikes[i]
		if strike.lands_at > time:
			continue
		strikes.remove_at(i)
		var impact := (
			strike.target
			+ Vector2.from_angle(_rng.randf() * TAU) * _rng.randf() * rules.strike_scatter
		)
		_report(&"strike_landed", null, {"position": impact})
		for unit in units:
			if not unit.is_on_map() or unit.position.distance_to(impact) > rules.strike_radius:
				continue
			var share := _rng.randf_range(rules.strike_damage_min, rules.strike_damage_max)
			var cover := lerpf(1.0, Terrain.COVER[map.terrain_at(unit.position)], rules.strike_cover)
			var losses := unit.max_strength() * share * cover * UnitKind.ARMOUR[unit.kind]
			unit.hit_at = time
			_hurt(unit, maxi(roundi(losses), 1))


## Units resting at their base slowly get their losses replaced.
func _refit_units() -> void:
	for unit in units:
		if not unit.is_on_map() or unit.strength >= unit.max_strength():
			continue
		var base := BattleMap.cell_centre(base_of(unit.side))
		var resting := (
			not unit.is_moving() and unit.target < 0 and time - unit.hit_at > rules.refit_interval
			and unit.position.distance_to(base) <= rules.refit_radius
		)
		if not resting:
			unit.refit = 0.0
			continue
		unit.refit += STEP
		if unit.refit >= rules.refit_interval:
			unit.refit = 0.0
			unit.strength += 1
			if unit.strength == unit.max_strength():
				_report(&"refitted", unit)


# --- Objectives and the result ----------------------------------------------

func _update_objectives() -> void:
	for objective in map.objectives:
		var i := objective.index
		var present := [false, false]
		var centre := BattleMap.cell_centre(objective.cell)
		for unit in units:
			if unit.is_on_map() and unit.position.distance_to(centre) <= rules.capture_radius:
				present[unit.side] = true
		var alone := -1
		if present[0] != present[1]:
			alone = 0 if present[0] else 1
		if alone < 0 or owners[i] == alone:
			capture_progress[i] = maxf(capture_progress[i] - STEP / rules.capture_time, 0.0)
			continue
		if capture_side[i] != alone:
			capture_side[i] = alone
			capture_progress[i] = 0.0
		capture_progress[i] += STEP / rules.capture_time
		if capture_progress[i] >= 1.0:
			owners[i] = alone
			capture_progress[i] = 0.0
			taken_at[i] = time
			var kind := &"objective_taken" if alone == BattleUnit.Side.PLAYER else &"objective_lost"
			_report(kind, null, {"objective": i})

	funds += rules.income * count_held(BattleUnit.Side.PLAYER) * STEP


func _check_result() -> void:
	if count_held(BattleUnit.Side.PLAYER) >= rules.objectives_to_win:
		hold_time += STEP
	else:
		hold_time = 0.0
	if hold_time >= rules.hold_to_win:
		result = Result.WON
	elif time >= rules.mission_time:
		result = Result.LOST
	elif count_units(BattleUnit.Side.PLAYER) == 0 and arrivals.is_empty():
		var cheapest: int = UnitKind.COST.min()
		if funds < cheapest:
			result = Result.LOST


# --- Radio ------------------------------------------------------------------

## Adds a line to the radio log. Reports of enemy units are never logged, and a unit
## does not repeat the same kind of report more often than REPORT_COOLDOWN.
func _report(kind: StringName, unit: BattleUnit, details: Dictionary = {}) -> void:
	if unit != null:
		if unit.side != BattleUnit.Side.PLAYER:
			return
		if time - unit.reported.get(kind, -100.0) < SLOW_REPORTS.get(kind, REPORT_COOLDOWN):
			return
		unit.reported[kind] = time
	var event := {"time": time, "kind": kind, "unit": unit.id if unit != null else -1}
	event.merge(details)
	events.append(event)

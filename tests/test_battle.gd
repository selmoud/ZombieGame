extends TestCase

const PLAYER := BattleUnit.Side.PLAYER
const ENEMY := BattleUnit.Side.ENEMY
const RIFLE := UnitKind.Type.RIFLE
const SCOUT := UnitKind.Type.SCOUT
const APC := UnitKind.Type.APC


## Open 40x20 field with two objectives and no enemy, so each test sets up its own.
func _field() -> BattleMap:
	var map := BattleMap.new(Vector2i(40, 20))
	map.add_objective("Первый", Vector2i(20, 10))
	map.add_objective("Второй", Vector2i(30, 10))
	map.player_base = Vector2i(1, 10)
	map.enemy_base = Vector2i(38, 10)
	return map


func _battle(map: BattleMap = null, rules: BattleRules = null) -> Battle:
	if rules == null:
		rules = BattleRules.new()
		rules.enemy_reinforce_interval = 100000.0
	return Battle.new(1, rules, map if map != null else _field())


func test_terrain_limits_each_kind_of_mover() -> void:
	var map := _field()
	map.paint_rect(Rect2i(10, 0, 2, 20), Terrain.Type.WATER)
	map.paint_rect(Rect2i(14, 0, 3, 20), Terrain.Type.FOREST)
	map.paint_rect(Rect2i(20, 0, 3, 8), Terrain.Type.TOWN)
	check(not map.is_passable(Vector2i(10, 5), Terrain.Mover.INFANTRY), "infantry in water")
	check(not map.is_passable(Vector2i(10, 5), Terrain.Mover.VEHICLE), "vehicle in water")
	check(map.is_passable(Vector2i(15, 5), Terrain.Mover.INFANTRY), "infantry in forest")
	check(not map.is_passable(Vector2i(15, 5), Terrain.Mover.VEHICLE), "vehicle in forest")
	check(map.is_passable(Vector2i(21, 5), Terrain.Mover.INFANTRY), "infantry in town")
	check(not map.is_passable(Vector2i(21, 5), Terrain.Mover.VEHICLE), "vehicle in town")

	check(map.find_path(Vector2i(5, 5), Vector2i(12, 5), Terrain.Mover.INFANTRY).is_empty(), "no way over water")
	map.paint_road([Vector2i(8, 5), Vector2i(24, 5)])
	check_eq(map.get_terrain(Vector2i(10, 5)), Terrain.Type.BRIDGE)
	check_eq(map.get_terrain(Vector2i(15, 5)), Terrain.Type.ROAD)
	var route := map.find_path(Vector2i(5, 5), Vector2i(24, 5), Terrain.Mover.VEHICLE)
	check(not route.is_empty(), "the road and the bridge make a way")
	for point in route:
		check(map.is_passable(Vector2i(point.floor()), Terrain.Mover.VEHICLE))


func test_order_fails_when_there_is_no_way() -> void:
	var map := _field()
	map.paint_rect(Rect2i(10, 0, 2, 20), Terrain.Type.WATER)
	var battle := _battle(map)
	var squad := battle.add_unit(PLAYER, RIFLE, Vector2i(5, 10))
	check(not battle.order_move(squad.id, Vector2i(30, 10)))
	check_eq(squad.order, BattleUnit.Order.HOLD)
	check(battle.order_move(squad.id, Vector2i(8, 3)))


func test_units_move_at_their_speed_and_report_arrival() -> void:
	var map := _field()
	map.paint_road([Vector2i(0, 15), Vector2i(39, 15)])
	var battle := _battle(map)
	var squad := battle.add_unit(PLAYER, RIFLE, Vector2i(2, 5))
	var carrier := battle.add_unit(PLAYER, APC, Vector2i(2, 15))
	battle.order_move(squad.id, Vector2i(30, 5))
	battle.order_move(carrier.id, Vector2i(38, 15))
	battle.advance(10.0)
	check(absf(squad.position.x - 8.5) < 0.2, "infantry: 0.6 cells a second, got %s" % squad.position)
	check(absf(carrier.position.x - 22.5) < 0.4, "vehicle on a road: 2 cells a second, got %s" % carrier.position)
	battle.advance(60.0)
	check_eq(squad.order, BattleUnit.Order.HOLD)
	check_eq(Vector2i(squad.position.floor()), Vector2i(30, 5))
	check(battle.events.any(func(event: Dictionary) -> bool: return event.kind == &"arrived" and event.unit == squad.id))


func test_forest_slows_infantry() -> void:
	var map := _field()
	map.paint_rect(Rect2i(0, 0, 40, 4), Terrain.Type.FOREST)
	var battle := _battle(map)
	var squad := battle.add_unit(PLAYER, RIFLE, Vector2i(2, 2))
	battle.order_move(squad.id, Vector2i(30, 2))
	battle.advance(10.0)
	check(squad.position.x < 6.0, "half speed in a forest, got %s" % squad.position)


func test_infantry_rides_in_a_carrier() -> void:
	var battle := _battle()
	var squad := battle.add_unit(PLAYER, RIFLE, Vector2i(3, 10))
	var carrier := battle.add_unit(PLAYER, APC, Vector2i(6, 10))
	var second := battle.add_unit(PLAYER, SCOUT, Vector2i(3, 12))
	check(not battle.order_embark(carrier.id, squad.id), "a vehicle cannot board infantry")
	check(battle.order_embark(squad.id, carrier.id))
	battle.advance(8.0)
	check_eq(squad.carrier, carrier.id)
	check_eq(carrier.passenger, squad.id)
	check(not squad.is_on_map())
	check(not battle.order_embark(second.id, carrier.id), "one squad per carrier")
	check(not battle.order_move(squad.id, Vector2i(10, 10)), "a carried squad takes no orders")

	battle.order_move(carrier.id, Vector2i(16, 10))
	battle.advance(12.0)
	check_eq(squad.position, carrier.position, "the squad travels with the carrier")
	check(battle.order_disembark(carrier.id))
	check(squad.is_on_map())
	check_eq(carrier.passenger, -1)
	check(squad.position.distance_to(carrier.position) <= 2.1)
	check(not battle.order_disembark(carrier.id), "nobody left inside")


func test_concealment_and_height_change_what_is_seen() -> void:
	var map := _field()
	map.paint_rect(Rect2i(20, 0, 4, 6), Terrain.Type.FOREST)
	map.paint_rect(Rect2i(2, 14, 3, 3), Terrain.Type.HILL)
	var battle := _battle(map)
	var watcher := battle.add_unit(PLAYER, RIFLE, Vector2i(13, 3))
	var in_open := battle.add_unit(ENEMY, RIFLE, Vector2i(20, 7))
	var in_forest := battle.add_unit(ENEMY, RIFLE, Vector2i(21, 3))
	battle.advance(0.2)
	check(battle.is_seen_by(PLAYER, in_open.id), "8 cells away in the open")
	check(not battle.is_seen_by(PLAYER, in_forest.id), "8 cells away in a forest")

	var far := battle.add_unit(ENEMY, RIFLE, Vector2i(15, 15))
	battle.advance(0.2)
	check(not battle.is_seen_by(PLAYER, far.id), "12 cells is beyond a rifle squad")
	var on_hill := battle.add_unit(PLAYER, RIFLE, Vector2i(3, 15))
	battle.advance(0.2)
	check(battle.is_seen_by(PLAYER, far.id), "the hill gives 13.5 cells of sight")
	check(on_hill.is_on_map())


func test_scout_sees_further_and_is_seen_later() -> void:
	var battle := _battle()
	var scout := battle.add_unit(PLAYER, SCOUT, Vector2i(5, 10))
	var enemy := battle.add_unit(ENEMY, RIFLE, Vector2i(16, 10))
	battle.advance(0.2)
	check(battle.is_seen_by(PLAYER, enemy.id), "11 cells is inside the scout's 14")
	check(not battle.is_seen_by(ENEMY, scout.id), "the scout is spotted only from 4.5 cells")


func test_contact_is_approximate_then_fades() -> void:
	var battle := _battle()
	var scout := battle.add_unit(PLAYER, RIFLE, Vector2i(5, 10))
	var enemy := battle.add_unit(ENEMY, APC, Vector2i(16, 10))
	battle.advance(0.2)
	check(battle.contacts.has(enemy.id), "an APC is seen from 12.6 cells")
	var contact := battle.contacts[enemy.id]
	check(contact.visible)
	check_eq(contact.kind, -1, "too far to identify")
	check(contact.error > 2.0, "far contact is imprecise: %.2f" % contact.error)
	check(contact.position.distance_to(enemy.position) <= contact.error + 0.01)
	check(battle.events.any(func(event: Dictionary) -> bool: return event.kind == &"contact"))

	enemy.position = Vector2(11.5, 10.5)
	battle.advance(0.2)
	check_eq(contact.kind, int(APC), "identified up close")
	check(contact.error < 1.6, "close contact is precise: %.2f" % contact.error)

	enemy.position = Vector2(38.5, 2.5)
	battle.advance(1.0)
	check(not contact.visible)
	check(battle.contacts.has(enemy.id), "the mark stays where the enemy was last seen")
	check(contact.position.distance_to(Vector2(11.5, 10.5)) < 2.0)
	battle.advance(battle.rules.contact_fade + 1.0)
	check(not battle.contacts.has(enemy.id), "an old mark disappears")
	check(scout.alive)


func test_firefight_costs_both_sides_and_cover_helps() -> void:
	var map := _field()
	map.paint_rect(Rect2i(20, 14, 3, 3), Terrain.Type.TOWN)
	var battle := _battle(map)
	var ours := battle.add_unit(PLAYER, RIFLE, Vector2i(10, 3))
	var theirs := battle.add_unit(ENEMY, RIFLE, Vector2i(14, 3))
	var attacker := battle.add_unit(PLAYER, RIFLE, Vector2i(17, 15))
	var defender := battle.add_unit(ENEMY, RIFLE, Vector2i(21, 15))
	battle.advance(20.0)
	check(ours.strength < 10 and theirs.strength < 10, "both lose men in the open")
	check_eq(ours.strength, theirs.strength, "equal squads trade evenly")
	check(defender.strength > attacker.strength, "the town protects its defender")
	check(battle.events.any(func(event: Dictionary) -> bool: return event.kind == &"under_fire"))


func test_weak_unit_pulls_back_and_a_dead_one_is_reported() -> void:
	var battle := _battle()
	var ours := battle.add_unit(PLAYER, RIFLE, Vector2i(10, 10))
	battle.add_unit(ENEMY, RIFLE, Vector2i(14, 10))
	battle.add_unit(ENEMY, RIFLE, Vector2i(14, 11))
	ours.strength = 5
	battle.advance(8.0)
	check_eq(ours.order, BattleUnit.Order.RETREAT, "pulls back at 30% strength")
	check(battle.events.any(func(event: Dictionary) -> bool: return event.kind == &"retreating"))
	ours.strength = 1
	battle.order_hold(ours.id)
	battle.advance(10.0)
	check(not ours.alive)
	check(battle.events.any(func(event: Dictionary) -> bool: return event.kind == &"unit_lost"))


func test_squad_bails_out_of_a_destroyed_carrier() -> void:
	var battle := _battle()
	var squad := battle.add_unit(PLAYER, RIFLE, Vector2i(5, 10))
	var carrier := battle.add_unit(PLAYER, APC, Vector2i(6, 10))
	battle.order_embark(squad.id, carrier.id)
	battle.advance(3.0)
	check_eq(squad.carrier, carrier.id)
	carrier.strength = 1
	battle.add_unit(ENEMY, APC, Vector2i(10, 10))
	battle.advance(15.0)
	check(not carrier.alive)
	check(squad.alive and squad.is_on_map(), "the squad survives outside")
	check(squad.strength <= 5, "but loses half of its men")


func test_moving_unit_halts_on_contact_unless_ordered_on() -> void:
	var battle := _battle()
	var squad := battle.add_unit(PLAYER, RIFLE, Vector2i(5, 10))
	battle.add_unit(ENEMY, SCOUT, Vector2i(19, 10))
	battle.order_move(squad.id, Vector2i(30, 10))
	battle.advance(18.0)
	check_eq(squad.order, BattleUnit.Order.HOLD, "stops when the enemy comes into view")
	check(squad.position.x < 16.0, "well short of the enemy: %s" % squad.position)
	check(battle.events.any(func(event: Dictionary) -> bool: return event.kind == &"halted"))

	var stopped_at := squad.position.x
	battle.order_move(squad.id, Vector2i(30, 3))
	check(squad.push, "a new order with the enemy in view means go anyway")
	battle.advance(5.0)
	check(squad.position.x > stopped_at)


func test_objective_is_taken_by_a_unit_left_alone_on_it() -> void:
	var battle := _battle()
	var squad := battle.add_unit(PLAYER, RIFLE, Vector2i(18, 10))
	check_eq(battle.owners[0], int(ENEMY))
	battle.order_capture(squad.id, 0)
	battle.advance(battle.rules.capture_time + 6.0)
	check_eq(battle.owners[0], int(PLAYER))
	check(battle.events.any(func(event: Dictionary) -> bool: return event.kind == &"objective_taken"))
	var before := battle.funds
	battle.advance(10.0)
	check(absf(battle.funds - before - 10.0 * battle.rules.income) < 0.2, "a held objective pays")

	var intruder := battle.add_unit(ENEMY, SCOUT, Vector2i(21, 11))
	squad.strength = 10
	battle.advance(1.0)
	check_eq(battle.owners[0], int(PLAYER), "a contested objective does not change hands")
	check(intruder.side == ENEMY)


func test_strike_costs_funds_and_hits_everyone_in_the_area() -> void:
	var rules := BattleRules.new()
	rules.strike_scatter = 0.0
	rules.enemy_reinforce_interval = 100000.0
	var battle := _battle(null, rules)
	var ours := battle.add_unit(PLAYER, RIFLE, Vector2i(30, 3))
	var theirs := battle.add_unit(ENEMY, RIFLE, Vector2i(31, 3))
	var away := battle.add_unit(PLAYER, RIFLE, Vector2i(5, 15))
	ours.order = BattleUnit.Order.RETREAT
	battle.funds = rules.strike_cost + 5.0
	check(battle.call_strike(Vector2(31.0, 3.5)))
	check(not battle.call_strike(Vector2(31.0, 3.5)), "no funds for a second one")
	check_eq(battle.strikes.size(), 1)
	battle.advance(rules.strike_delay - 1.0)
	var before_ours := ours.strength
	var before_theirs := theirs.strength
	battle.advance(1.5)
	check(battle.strikes.is_empty())
	check(ours.strength < before_ours, "own troops in the area are hit too")
	check(theirs.strength < before_theirs)
	check_eq(away.strength, 10)
	check(battle.events.any(func(event: Dictionary) -> bool: return event.kind == &"strike_landed"))


func test_units_are_bought_at_once_before_the_start_and_with_a_delay_after() -> void:
	var battle := _battle()
	check(battle.buy_unit(RIFLE))
	check_eq(battle.count_units(PLAYER), 1)
	check_eq(battle.funds, battle.rules.start_funds - UnitKind.COST[RIFLE])
	battle.advance(1.0)
	check(battle.buy_unit(SCOUT))
	check_eq(battle.count_units(PLAYER), 1, "ordered, not yet here")
	battle.advance(battle.rules.arrival_delay + 0.5)
	check_eq(battle.count_units(PLAYER), 2)
	battle.funds = 10.0
	check(not battle.buy_unit(SCOUT), "not enough funds")
	check(battle.units[0].call_sign != battle.units[1].call_sign)


func test_mission_is_won_by_holding_objectives_without_a_break() -> void:
	var rules := BattleRules.new()
	rules.hold_to_win = 30.0
	rules.enemy_reinforce_interval = 100000.0
	var battle := _battle(null, rules)
	battle.add_unit(PLAYER, RIFLE, Vector2i(20, 10))
	battle.add_unit(PLAYER, RIFLE, Vector2i(30, 10))
	battle.advance(rules.capture_time + 10.0)
	check_eq(battle.count_held(PLAYER), 2)
	check(battle.hold_time > 5.0)
	check_eq(battle.result, Battle.Result.ONGOING)
	battle.owners[1] = ENEMY
	battle.advance(0.2)
	check_eq(battle.hold_time, 0.0, "losing an objective resets the count")
	battle.owners[1] = PLAYER
	battle.advance(rules.hold_to_win + 1.0)
	check_eq(battle.result, Battle.Result.WON)
	var finished_at := battle.time
	battle.advance(10.0)
	check_eq(battle.time, finished_at, "time stops at the result")


func test_mission_is_lost_on_time_or_when_nothing_is_left() -> void:
	var rules := BattleRules.new()
	rules.mission_time = 20.0
	rules.enemy_reinforce_interval = 100000.0
	var timed := _battle(null, rules)
	timed.add_unit(PLAYER, RIFLE, Vector2i(5, 5))
	timed.advance(25.0)
	check_eq(timed.result, Battle.Result.LOST)

	var wiped := _battle()
	wiped.funds = 0.0
	var last := wiped.add_unit(PLAYER, SCOUT, Vector2i(5, 5))
	wiped.advance(1.0)
	check_eq(wiped.result, Battle.Result.ONGOING)
	last.strength = 1
	wiped.add_unit(ENEMY, RIFLE, Vector2i(7, 5))
	wiped.advance(30.0)
	check_eq(wiped.result, Battle.Result.LOST)


func test_enemy_reserve_retakes_a_lost_objective_and_gets_reinforced() -> void:
	var rules := BattleRules.new()
	rules.enemy_reinforce_interval = 50.0
	var battle := _battle(null, rules)
	var reserve := battle.add_unit(ENEMY, RIFLE, Vector2i(37, 10))
	reserve.role = BattleUnit.Role.RESERVE
	battle.owners[0] = PLAYER
	battle.taken_at[0] = 0.0
	battle.advance(rules.counterattack_delay - 5.0)
	check_eq(reserve.order, BattleUnit.Order.HOLD, "waits before the counterattack")
	battle.advance(10.0)
	check_eq(reserve.order, BattleUnit.Order.CAPTURE)
	check_eq(reserve.objective, 0)
	battle.advance(80.0)
	check_eq(battle.owners[0], int(ENEMY), "an undefended objective is retaken")
	check(battle.count_units(ENEMY) >= 2, "a reinforcement has arrived")
	check(battle.events.any(func(event: Dictionary) -> bool: return event.kind == &"objective_lost"))


func test_enemy_garrison_returns_to_its_post() -> void:
	var battle := _battle()
	var garrison := battle.add_unit(ENEMY, RIFLE, Vector2i(25, 10))
	garrison.role = BattleUnit.Role.GARRISON
	garrison.home_cell = Vector2i(20, 9)
	battle.advance(20.0)
	check_eq(Vector2i(garrison.position.floor()), Vector2i(20, 9))


func test_default_mission_is_set_up_and_reproducible() -> void:
	var battle := Battle.new(5)
	check_eq(battle.map.objectives.size(), 3)
	check_eq(battle.count_units(ENEMY), 5)
	check_eq(battle.count_held(ENEMY), 3)
	for objective in battle.map.objectives:
		check(battle.map.is_passable(objective.cell, Terrain.Mover.VEHICLE), "%s is reachable by road" % objective.title)
		var route := battle.map.find_path(battle.map.player_base, objective.cell, Terrain.Mover.VEHICLE)
		check(not route.is_empty(), "a vehicle can drive to %s" % objective.title)
	check_eq(battle.map.square_name(Vector2(0.5, 0.5)), "А1")
	check_eq(battle.map.square_name(Vector2(29.5, 9.5)), "Д2")

	var other := Battle.new(5)
	for mission: Battle in [battle, other]:
		mission.buy_unit(RIFLE)
		mission.buy_unit(APC)
		mission.order_capture(5, 0)
		mission.order_capture(6, 0)
		mission.advance(200.0)
	check_eq(battle.units[5].strength, other.units[5].strength)
	check_eq(battle.units[6].position, other.units[6].position)
	check_eq(battle.events.size(), other.events.size())

class_name SupplyGame
extends RefCounted
## Rules of the supply game. Holds the whole state and has no dependency on nodes
## or rendering, so a full mission can be played from a test or a bot.

enum Cargo { FUEL, AMMO, FOOD }
enum TruckState { IDLE, LOADED, OUTBOUND, RETURNING, LOST }

const CARGO_COUNT := 3


class Truck:
	var id: int
	var state := TruckState.IDLE
	var cargo := PackedInt32Array([0, 0, 0])
	var target := -1
	var route := PackedInt32Array()
	## Legs already travelled in the current direction.
	var legs_done := 0
	## Last node the truck reached.
	var node := SupplyMap.DEPOT


class Company:
	var node: int
	var stock := PackedInt32Array([0, 0, 0])
	var readiness := 0
	var battle_today := false
	var battle_tomorrow := false
	var lost := false


var rules: SupplyRules
var map: SupplyMap
var day := 1
var trucks: Array[Truck] = []
var companies: Array[Company] = []
## Days each road stays cut, indexed by road id; 0 means open.
var blocked := PackedInt32Array()
## What happened during the last end_turn(), as dictionaries with a `kind` key.
var events: Array[Dictionary] = []

var _rng := RandomNumberGenerator.new()


func _init(seed_value: int, game_rules: SupplyRules = null, game_map: SupplyMap = null) -> void:
	rules = game_rules if game_rules != null else SupplyRules.new()
	map = game_map if game_map != null else SupplyMap.create_default()
	_rng.seed = seed_value
	blocked.resize(map.roads.size())
	for i in rules.truck_count:
		var truck := Truck.new()
		truck.id = i
		trucks.append(truck)
	for node_id in map.get_company_ids():
		var company := Company.new()
		company.node = node_id
		company.stock.fill(rules.start_stock)
		company.readiness = rules.max_readiness
		company.battle_tomorrow = _rng.randf() < rules.battle_chance
		companies.append(company)


func get_company(node_id: int) -> Company:
	for company in companies:
		if company.node == node_id:
			return company
	return null


func get_lost_count() -> int:
	var count := 0
	for company in companies:
		if company.lost:
			count += 1
	return count


func get_trucks_alive() -> int:
	var count := 0
	for truck in trucks:
		if truck.state != TruckState.LOST:
			count += 1
	return count


func is_over() -> bool:
	return get_lost_count() >= rules.sectors_to_lose or day > rules.days


func is_won() -> bool:
	return day > rules.days and get_lost_count() < rules.sectors_to_lose


func is_route_blocked(route: PackedInt32Array) -> bool:
	for road_id in route:
		if blocked[road_id] > 0:
			return true
	return false


## Routes from the depot to a company, shortest and safest first.
func get_routes(target: int) -> Array[PackedInt32Array]:
	return map.find_routes(SupplyMap.DEPOT, target)


## Returns an empty string when the order is accepted, otherwise the reason it is not.
func give_order(
	truck_id: int, target: int, cargo: PackedInt32Array, route: PackedInt32Array
) -> String:
	if is_over():
		return "mission is over"
	if truck_id < 0 or truck_id >= trucks.size():
		return "no such truck"
	var truck := trucks[truck_id]
	if truck.state != TruckState.IDLE:
		return "truck is not free"
	var company := get_company(target)
	if company == null:
		return "target is not a company"
	if company.lost:
		return "sector is lost"
	if cargo.size() != CARGO_COUNT:
		return "bad cargo"
	var total := 0
	for amount in cargo:
		if amount < 0:
			return "bad cargo"
		total += amount
	if total == 0:
		return "truck is empty"
	if total > rules.truck_capacity:
		return "truck is overloaded"
	if not _is_route_valid(route, target):
		return "route does not lead to the target"

	truck.state = TruckState.LOADED
	truck.cargo = cargo.duplicate()
	truck.target = target
	truck.route = route.duplicate()
	truck.legs_done = 0
	return ""


func cancel_order(truck_id: int) -> bool:
	if truck_id < 0 or truck_id >= trucks.size():
		return false
	var truck := trucks[truck_id]
	if truck.state != TruckState.LOADED:
		return false
	_reset_truck(truck)
	return true


func end_turn() -> void:
	if is_over():
		return
	events.clear()
	_move_trucks()
	_consume()
	_roll_next_day()
	day += 1


func _is_route_valid(route: PackedInt32Array, target: int) -> bool:
	if route.is_empty():
		return false
	var at := SupplyMap.DEPOT
	var visited := PackedInt32Array([at])
	for road_id in route:
		at = map.step(road_id, at)
		if at < 0 or visited.has(at):
			return false
		visited.append(at)
	return at == target


func _reset_truck(truck: Truck) -> void:
	truck.state = TruckState.IDLE
	truck.cargo.fill(0)
	truck.target = -1
	truck.route = PackedInt32Array()
	truck.legs_done = 0
	truck.node = SupplyMap.DEPOT


func _move_trucks() -> void:
	for truck in trucks:
		if truck.state == TruckState.LOADED:
			truck.state = TruckState.OUTBOUND
		if truck.state != TruckState.OUTBOUND and truck.state != TruckState.RETURNING:
			continue

		var outbound := truck.state == TruckState.OUTBOUND
		var leg := truck.legs_done if outbound else truck.route.size() - 1 - truck.legs_done
		var road_id := truck.route[leg]
		if blocked[road_id] > 0:
			events.append({"kind": &"waiting", "truck": truck.id, "road": road_id})
			continue
		if map.roads[road_id].risky and _rng.randf() < rules.ambush_chance:
			truck.state = TruckState.LOST
			events.append({
				"kind": &"ambush", "truck": truck.id, "road": road_id,
				"cargo": truck.cargo.duplicate(),
			})
			continue

		truck.node = map.other_end(road_id, truck.node)
		truck.legs_done += 1
		if truck.legs_done < truck.route.size():
			continue
		if outbound:
			_unload(truck)
			truck.state = TruckState.RETURNING
			truck.legs_done = 0
		else:
			_reset_truck(truck)


func _unload(truck: Truck) -> void:
	var company := get_company(truck.target)
	if company.lost:
		events.append({"kind": &"turned_back", "truck": truck.id, "company": company.node})
		return
	var delivered := PackedInt32Array([0, 0, 0])
	for cargo in CARGO_COUNT:
		var amount := mini(truck.cargo[cargo], rules.stock_cap - company.stock[cargo])
		company.stock[cargo] += amount
		truck.cargo[cargo] -= amount
		delivered[cargo] = amount
	events.append({
		"kind": &"delivered", "truck": truck.id, "company": company.node, "cargo": delivered,
	})


func _consume() -> void:
	for company in companies:
		if company.lost:
			continue
		var shortages: PackedInt32Array = []
		var loss := 0
		if not _take(company, Cargo.FOOD, rules.food_per_day):
			shortages.append(Cargo.FOOD)
			loss += 1
		if not _take(company, Cargo.FUEL, rules.fuel_per_day):
			shortages.append(Cargo.FUEL)
			loss += 1
		if company.battle_today and not _take(company, Cargo.AMMO, rules.ammo_per_battle):
			shortages.append(Cargo.AMMO)
			loss += rules.battle_penalty

		if shortages.is_empty():
			company.readiness = mini(company.readiness + 1, rules.max_readiness)
			continue
		company.readiness = maxi(company.readiness - loss, 0)
		events.append({
			"kind": &"shortage", "company": company.node, "cargo": shortages,
			"readiness": company.readiness,
		})
		if company.readiness == 0:
			company.lost = true
			events.append({"kind": &"sector_lost", "company": company.node})


## Takes the amount from the stock; when there is not enough, takes what is left.
func _take(company: Company, cargo: Cargo, amount: int) -> bool:
	var enough := company.stock[cargo] >= amount
	company.stock[cargo] = maxi(company.stock[cargo] - amount, 0)
	return enough


func _roll_next_day() -> void:
	var open_roads: PackedInt32Array = []
	for road_id in blocked.size():
		if blocked[road_id] > 0:
			blocked[road_id] -= 1
			if blocked[road_id] == 0:
				events.append({"kind": &"road_opened", "road": road_id})
		else:
			open_roads.append(road_id)
	if not open_roads.is_empty() and _rng.randf() < rules.block_chance:
		var road_id := open_roads[_rng.randi_range(0, open_roads.size() - 1)]
		blocked[road_id] = _rng.randi_range(rules.block_days_min, rules.block_days_max)
		events.append({"kind": &"road_cut", "road": road_id, "days": blocked[road_id]})

	for company in companies:
		company.battle_today = company.battle_tomorrow
		company.battle_tomorrow = _rng.randf() < rules.battle_chance

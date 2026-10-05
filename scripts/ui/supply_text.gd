class_name SupplyText
extends RefCounted
## Player-facing wording for the supply game: names, statuses and the daily report.

const CARGO_TITLES: PackedStringArray = ["Топливо", "Боеприпасы", "Продовольствие"]
const CARGO_NAMES: PackedStringArray = ["топливо", "боеприпасы", "продовольствие"]


static func node_title(game: SupplyGame, node_id: int) -> String:
	return game.map.nodes[node_id].title


static func truck_title(truck_id: int) -> String:
	return "№%d" % (truck_id + 1)


static func cargo_list(cargo: PackedInt32Array) -> String:
	var parts: PackedStringArray = []
	for i in cargo.size():
		if cargo[i] > 0:
			parts.append("%s %d" % [CARGO_NAMES[i], cargo[i]])
	return ", ".join(parts) if not parts.is_empty() else "пусто"


static func road_title(game: SupplyGame, road_id: int) -> String:
	var road := game.map.roads[road_id]
	return "%s — %s" % [node_title(game, road.a), node_title(game, road.b)]


## "Склад → Северный узел → 1-я рота"
static func route_chain(game: SupplyGame, route: PackedInt32Array) -> String:
	var at := SupplyMap.DEPOT
	var parts: PackedStringArray = [node_title(game, at)]
	for road_id in route:
		at = game.map.other_end(road_id, at)
		parts.append(node_title(game, at))
	return " → ".join(parts)


## "2 сут. в пути · безопасно"
static func route_summary(game: SupplyGame, route: PackedInt32Array) -> String:
	var parts: PackedStringArray = ["%d сут. в пути" % route.size()]
	var risky := game.map.count_risky(route)
	if risky == 0:
		parts.append("безопасно")
	else:
		parts.append("опасных перегонов: %d" % risky)
	if game.is_route_blocked(route):
		parts.append("перерезана")
	return " · ".join(parts)


static func truck_status(game: SupplyGame, truck: SupplyGame.Truck) -> String:
	match truck.state:
		SupplyGame.TruckState.IDLE:
			return "на складе, свободен"
		SupplyGame.TruckState.LOADED:
			return "приказ: %s (%s)" % [node_title(game, truck.target), cargo_list(truck.cargo)]
		SupplyGame.TruckState.OUTBOUND:
			return "едет: %s (%s)" % [node_title(game, truck.target), cargo_list(truck.cargo)]
		SupplyGame.TruckState.RETURNING:
			return "возвращается, ещё %d сут." % (truck.route.size() - truck.legs_done)
		_:
			return "уничтожен"


static func describe_event(game: SupplyGame, event: Dictionary) -> String:
	match event.kind:
		&"delivered":
			var cargo: PackedInt32Array = event.cargo
			var what := cargo_list(cargo)
			if what == "пусто":
				what = "склад роты полон, груз не принят"
			return "Грузовик %s → %s: %s." % [
				truck_title(event.truck), node_title(game, event.company), what,
			]
		&"ambush":
			return "Засада на дороге %s: грузовик %s уничтожен." % [
				road_title(game, event.road), truck_title(event.truck),
			]
		&"waiting":
			return "Грузовик %s ждёт: дорога %s перерезана." % [
				truck_title(event.truck), road_title(game, event.road),
			]
		&"turned_back":
			return "Грузовик %s повернул назад: %s — участок потерян." % [
				truck_title(event.truck), node_title(game, event.company),
			]
		&"shortage":
			var names: PackedStringArray = []
			for cargo: int in event.cargo:
				names.append(CARGO_NAMES[cargo])
			return "%s: нехватка — %s. Боеспособность %d." % [
				node_title(game, event.company), ", ".join(names), event.readiness,
			]
		&"sector_lost":
			return "%s отошла. Участок потерян." % node_title(game, event.company)
		&"road_cut":
			return "Дорога %s перерезана на %d сут." % [road_title(game, event.road), event.days]
		&"road_opened":
			return "Дорога %s снова открыта." % road_title(game, event.road)
	return ""

class_name BattleText
extends RefCounted
## Player-facing wording: unit names, orders and radio messages.

const KIND_TITLES: PackedStringArray = ["Стрелковое отделение", "Разведгруппа", "Бронетранспортёр"]
const KIND_SHORT: PackedStringArray = ["Стрелки", "Разведка", "БТР"]
const CONTACT_TITLES: PackedStringArray = ["пехота", "разведгруппа", "бронетехника"]
const CONTACT_UNKNOWN := "не опознан"
const TERRAIN_TITLES: PackedStringArray = [
	"поле", "дорога", "лес", "высота", "застройка", "вода", "мост",
]


static func clock(seconds: float) -> String:
	var total := maxi(int(seconds), 0)
	return "%d:%02d" % [total / 60, total % 60]


static func contact_title(kind: int) -> String:
	return CONTACT_TITLES[kind] if kind >= 0 else CONTACT_UNKNOWN


static func order_title(battle: Battle, unit: BattleUnit) -> String:
	if unit.carrier >= 0:
		return "в десанте: %s" % battle.units[unit.carrier].call_sign
	match unit.order:
		BattleUnit.Order.MOVE:
			return "выдвигается"
		BattleUnit.Order.CAPTURE:
			return "занимает: %s" % battle.map.objectives[unit.objective].title
		BattleUnit.Order.RETREAT:
			return "отходит"
		BattleUnit.Order.EMBARK:
			return "идёт на погрузку"
	return "ведёт бой" if unit.target >= 0 else "на месте"


static func describe_event(battle: Battle, event: Dictionary) -> String:
	var who := ""
	if event.unit >= 0:
		who = battle.units[event.unit].call_sign
	var square := ""
	if event.has("position"):
		square = battle.map.square_name(event.position)
	match event.kind:
		&"contact":
			return "%s: контакт, квадрат %s — %s." % [who, square, contact_title(event.contact_kind)]
		&"under_fire":
			return "%s: под огнём, квадрат %s!" % [who, square]
		&"casualties":
			return "%s: несу потери, осталось %d." % [who, event.strength]
		&"retreating":
			return "%s: большие потери, отхожу." % who
		&"unit_lost":
			return "%s не отвечает. Отряд потерян, квадрат %s." % [who, square]
		&"halted":
			return "%s: вижу противника, остановился." % who
		&"arrived":
			return "%s: на месте." % who
		&"embarked":
			return "%s: погрузились, борт %s." % [who, battle.units[event.carrier].call_sign]
		&"disembarked":
			return "%s: спешились." % who
		&"refitted":
			return "%s: пополнение принял, состав полный." % who
		&"arrived_reinforcement":
			return "%s: прибыл в район высадки." % who
		&"enemy_destroyed":
			return "Наблюдаю: противник в квадрате %s уничтожен." % square
		&"objective_taken":
			return "Объект «%s» взят." % battle.map.objectives[event.objective].title
		&"objective_lost":
			return "Объект «%s» потерян!" % battle.map.objectives[event.objective].title
		&"strike_called":
			return "Артиллерия: задачу принял, квадрат %s." % square
		&"strike_landed":
			return "Артиллерия: разрывы в квадрате %s." % square
	return ""


## Messages that deserve attention are shown in a warning colour.
static func is_alarm(event: Dictionary) -> bool:
	return event.kind in [
		&"under_fire", &"casualties", &"retreating", &"unit_lost", &"objective_lost",
	]

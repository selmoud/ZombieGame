class_name HexGrid
extends RefCounted
## Hexagons laid over the map, pointy side up. A hex is named by its axial
## coordinates (q, r); `size` is the distance from its centre to a corner, in cells.

const SQRT3 := 1.7320508
const NEIGHBOURS: Array[Vector2i] = [
	Vector2i(1, 0), Vector2i(1, -1), Vector2i(0, -1), Vector2i(-1, 0), Vector2i(-1, 1), Vector2i(0, 1),
]
const LETTERS := "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ"


static func at(position: Vector2, size: float) -> Vector2i:
	var q := (SQRT3 / 3.0 * position.x - position.y / 3.0) / size
	var r := (2.0 / 3.0 * position.y) / size
	# Round in cube coordinates, then fix the axis that moved the most.
	var s := -q - r
	var round_q := roundf(q)
	var round_r := roundf(r)
	var round_s := roundf(s)
	var dq := absf(round_q - q)
	var dr := absf(round_r - r)
	var ds := absf(round_s - s)
	if dq > dr and dq > ds:
		round_q = -round_r - round_s
	elif dr > ds:
		round_r = -round_q - round_s
	return Vector2i(int(round_q), int(round_r))


static func centre(hex: Vector2i, size: float) -> Vector2:
	return Vector2(size * SQRT3 * (hex.x + hex.y / 2.0), size * 1.5 * hex.y)


static func distance(a: Vector2i, b: Vector2i) -> int:
	var dq := a.x - b.x
	var dr := a.y - b.y
	return (absi(dq) + absi(dr) + absi(dq + dr)) / 2


## The hexes exactly `radius` steps from the centre; the centre itself for radius 0.
static func ring(middle: Vector2i, radius: int) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	if radius == 0:
		result.append(middle)
		return result
	var hex := middle + NEIGHBOURS[4] * radius
	for side in 6:
		for step in radius:
			result.append(hex)
			hex += NEIGHBOURS[side]
	return result


static func corners(hex: Vector2i, size: float) -> PackedVector2Array:
	var middle := centre(hex, size)
	var points := PackedVector2Array()
	for i in 6:
		points.append(middle + Vector2.from_angle(TAU * i / 6.0 + TAU / 12.0) * size)
	return points


## Column and row of the hex as in a table: rows run across, odd rows are shifted.
static func offset(hex: Vector2i) -> Vector2i:
	return Vector2i(hex.x + (hex.y - (hex.y & 1)) / 2, hex.y)


## Name used in radio reports and printed in the hex, like "Е7".
static func title(hex: Vector2i) -> String:
	var cell := offset(hex)
	return "%s%d" % [LETTERS[clampi(cell.x, 0, LETTERS.length() - 1)], cell.y + 1]

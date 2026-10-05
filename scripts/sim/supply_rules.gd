class_name SupplyRules
extends Resource
## Tunable numbers of the supply game. Every value here is a balance candidate;
## tools/balance.gd shows how a change affects automatic players.

@export var days := 14
@export var truck_count := 5
@export var truck_capacity := 6
@export var stock_cap := 6
@export var start_stock := 3
@export var max_readiness := 5
@export var food_per_day := 1
@export var fuel_per_day := 1
@export var ammo_per_battle := 2
## Readiness lost when a company fights without enough ammunition.
@export var battle_penalty := 2
@export var battle_chance := 0.4
## Chance to lose a truck on each risky road leg.
@export var ambush_chance := 0.12
## Chance per day that one open road gets cut.
@export var block_chance := 0.2
@export var block_days_min := 2
@export var block_days_max := 3
## The mission fails when this many sectors are lost.
@export var sectors_to_lose := 2

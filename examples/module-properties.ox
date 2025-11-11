// Module Property Injection Example
// Demonstrates Phase 5: External data injection into tagged blocks

// Game entities with module properties injected from external state
#entity(Player) [MainPlayer (x: 100, y: 200, name: "Hero")]

#entity(Enemy) [Goblin (x: 300, y: 150, name: "Goblin Scout")]

#entity(NPC) [Merchant (x: 500, y: 400, name: "Shop Keeper")]

// UI components with theme properties injected
#styled [PrimaryButton (label: "Start Game", x: 50, y: 50)]

#styled [SecondaryButton (label: "Settings", x: 50, y: 100)]

// Nested example
[GameScene
  #entity(Player) [Player1 (x: 10, y: 10)]

  [EnemyGroup
    #entity(Enemy) [Enemy1 (x: 100, y: 50)]
    #entity(Enemy) [Enemy2 (x: 150, y: 50)]
  ]
]

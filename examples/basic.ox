// Basic OX example

<set margin = 20>
<set screenWidth = 1920>
<set screenHeight = 1080>

// Simple blocks
[Container (width: (screenWidth), height: (screenHeight), padding: (margin))
  [Header (height: 60, title: "My App")]

  [MainContent (
    y: 60,
    width: ($parent.width - margin * 2),
    height: ($parent.height - 60 - margin)
  )
    [Section (title: "Welcome")]
    [Section (title: "Content")]
  ]
]

// Tagged block
@component(Button)
[Button (width: 100, height: 50, label: "Default")]

// UI Layout example with templates

<set baseSize = 16>
<set primaryColor = "blue">

<if (darkMode)>
  <set bgColor = "#222">
  <set textColor = "#fff">
<else>
  <set bgColor = "#fff">
  <set textColor = "#222">
</if>

[App (width: 1200, height: 800)
  [Sidebar (
    width: 300,
    background: (bgColor),
    color: (textColor)
  )
    [Logo (height: 60)]

    [Navigation
      <foreach (item in navItems)>
        [NavItem (
          label: (item.label),
          url: (item.url),
          active: (item.active)
        )]
      </foreach>
    ]
  ]

  [MainArea (
    x: 300,
    width: ($parent.width - $Sidebar.width),
    padding: (baseSize * 2)
  )
    <on-data posts>
      [PostList
        <foreach (post in posts)>
          [Post (
            title: (post.title),
            author: (post.author),
            date: (post.date)
          )]
        </foreach>
      ]
    <on-error>
      [ErrorMessage (text: "Failed to load posts")]
    </on-data>
  ]
]

export const members = [
  { id: 1, name: "You", avatar: "/portrait-young-person-smiling.jpg", balance: 125.37, initials: "YO" },
  { id: 2, name: "Sarah", avatar: "/portrait-woman-blonde-smiling.jpg", balance: -45.2, initials: "SA" },
  { id: 3, name: "Mike", avatar: "/portrait-man-brown-hair-casual.jpg", balance: 80.0, initials: "MI" },
  { id: 4, name: "Emma", avatar: "/portrait-woman-brunette-friendly.jpg", balance: -160.17, initials: "EM" },
  { id: 5, name: "Jake", avatar: "/portrait-man-beard-casual.jpg", balance: 0, initials: "JA" },
]

export type Member = (typeof members)[number]

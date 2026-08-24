export function getProfileFirstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "there";
}

export function getProfileInitials(name?: string | null) {
  const initials = (name || "Faro member").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("");
  return initials || "F";
}

export function getMembershipLabel(createdAt?: Date | string | null) {
  if (!createdAt) return "Private Faro AI member";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Private Faro AI member";
  return `Member since ${date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

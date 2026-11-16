const BUDDY_WEEK = /^\/home\/buddies\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isBuddyWeekPath(url: string): boolean {
  return BUDDY_WEEK.test(url)
}

export function buddyWeekPath(pairId: string): string {
  return `/home/buddies/${pairId}`
}

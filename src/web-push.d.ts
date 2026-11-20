declare module "web-push" {
  interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void
    generateVAPIDKeys(): { publicKey: string; privateKey: string }
    sendNotification(
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string | null,
      options?: { TTL?: number; timeout?: number },
    ): Promise<{ statusCode?: number }>
  }
  const webpush: WebPush
  export default webpush
}

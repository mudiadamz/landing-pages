import { serveBlogFeed } from "@/lib/blog-feed-route";

export const GET = (req: Request) => serveBlogFeed(req, "rss");

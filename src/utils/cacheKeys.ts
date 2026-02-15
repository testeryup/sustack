export function getPostListKey(page: number, limit: number): string {
  return `posts:list:page:${page}:limit:${limit}`;
}

export function getPostSlugKey(slug: string): string {
  return `post:slug:${slug}`;
}

export const POST_LIST_PATTERN = "posts:list:*";

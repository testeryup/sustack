/**
 * AST Worker — chạy trên Worker Thread (nhân CPU riêng).
 * Nhiệm vụ: Parse Markdown content → trích xuất publicId của tất cả ảnh.
 *
 * Không có side effect (DB, network) — chỉ tính toán thuần túy.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';

/**
 * Trích xuất publicId của Cloudinary từ URL ảnh.
 * Ví dụ URL: https://res.cloudinary.com/xxx/image/upload/v123/sustack_blog/abc123.jpg
 * → publicId: "sustack_blog/abc123"
 */
function extractPublicId(url: string): string | null {
  try {
    // Cloudinary URL pattern: .../upload/v{version}/{folder}/{filename}.{ext}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.*?)(?:\.\w+)?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Parse Markdown → AST → tìm tất cả node `image` → trả về mảng publicId.
 */
export default function parseMarkdownImages({ content, thumbnail }: { content: string, thumbnail?: string | null }): string[] {
  const publicIds: string[] = [];

  // 1. Extract publicId từ thumbnail (nếu có)
  if (thumbnail) {
    const thumbPublicId = extractPublicId(thumbnail);
    if (thumbPublicId) {
      publicIds.push(thumbPublicId);
    }
  }

  // 2. Extract publicId từ content
  const tree = unified().use(remarkParse).parse(content);

  visit(tree, 'image', (node: any) => {
    const publicId = extractPublicId(node.url);
    if (publicId) {
      publicIds.push(publicId);
    }
  });

  return publicIds;
}

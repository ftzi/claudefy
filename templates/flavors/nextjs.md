## Next.js

This is a Next.js project.

- **Server Components:** Default to Server Components; use `"use client"` directive only when needed
- Don't import Server Components into Client Components - pass as `children` instead
- `"use client"` files cannot export Server Actions - keep them in separate files

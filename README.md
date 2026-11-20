# AI Super Power

MVP website with 6 AI tools (text-only outputs). Built with plain Node.js, no external dependencies.

## Tools

1. **Studio Video AI** - Script and prompt writing for video tools
2. **Trợ lý AI riêng** - Personal AI assistant chat
3. **Viết quảng cáo** - Ad copy: headlines, descriptions, captions
4. **Thiết kế hình ảnh & slide** - Layout, text, color suggestions
5. **Ý tưởng nội dung** - Brainstorm topics and outlines
6. **Tự động hóa** - Workflow drafting for n8n/Make

## Setup

1. Copy `.env.example` to `.env` and fill in your `OPENAI_API_KEY`
2. Run `node server.js`
3. Open `http://localhost:3000`
4. Login with demo admin: `admin@local.test` / `ChangeMe123!`
5. **Change the admin password immediately**

## Deploy

Free tier on Render or Railway. Set `OPENAI_API_KEY` as an environment variable. Do not enable paid services.

## Notes

- All tools return text only. No real video/image/file rendering.
- Virtual currency features are placeholders.
- Dark theme, Vietnamese UI.

# Local RSS

This plugin allows you to save articles from RSS feeds as local markdown files.

## Features

- Fetch articles from RSS feeds and save them as markdown files
- Manage multiple RSS feeds
- Automatic periodic updates
- Customizable file names and content templates
- Front matter and tag support

## Usage

1. Install and enable the plugin
2. Configure the RSS folder in settings (default is "RSS")
3. Click the "Add Feed" button to add a new feed
4. Enter the feed name and URL (folder name is optional)
5. Click the "Update Now" button to update the feed, or wait for automatic background updates

### Commands

- **Update RSS feeds**: Update all enabled RSS feeds
- **Add RSS feed**: Add a new RSS feed

### Template Variables

Variables available in file name and content templates:

- `{{title}}`: Article title
- `{{link}}`: Article URL
- `{{author}}`: Article author
- `{{published}}`: Publication date (YYYY-MM-DD format)
- `{{publishedTime}}`: Publication date and time (displayed in configured datetime format)
- `{{savedTime}}`: Date and time when the article was saved
- `{{#tags}}`: Display categories as tags
- `{{#image}}...{{/image}}`: Image block (displayed only if image exists)
- `{{image}}`: Article image URL (use within image block)
- `{{imageWidth}}`: Image width (specified in settings)
- `{{content}}`: Article content


## Development

- Clone this repository
- Install dependencies with `npm i` or `yarn`
- Start development mode with `npm run dev`

## License

[MIT](LICENSE)

## Acknowledgments

This plugin is inspired by the implementation of [joethei/obsidian-rss](https://github.com/joethei/obsidian-rss).
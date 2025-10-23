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

You can use the following variables in file name and content templates:

#### Basic Information
- `{{title}}`: Article title
- `{{link}}`: Original article URL
- `{{author}}`: Article author name
- `{{content}}`: Full article content (HTML)

#### Date & Time
- `{{publishedTime}}`: Publication date and time (YYYY-MM-DD HH:mm:ss format)
- `{{savedTime}}`: Date and time when the article was saved to your vault

#### Images
- `{{image}}`: Article image URL (can be used in frontmatter or content)

#### Description
- `{{description}}`: Full article description/summary
- `{{descriptionShort}}`: First 50 characters of the description

#### Tags
- `{{#tags}}`: Article categories formatted as hashtags (e.g., "#tech #news")

#### Example Template (Default)
```
---
title: {{title}}
link: {{link}}
author: {{author}}
publish_date: {{publishedTime}}
saved_date: {{savedTime}}
image: {{image}}
tags: {{#tags}}
---

![image]({{image}})

{{content}}
```

#### Advanced Examples

**With description:**
```
---
title: {{title}}
link: {{link}}
author: {{author}}
publish_date: {{publishedTime}}
saved_date: {{savedTime}}
image: {{image}}
description: {{descriptionShort}}
tags: {{#tags}}
---

![image]({{image}})

{{content}}
```

**Note**: The `publish_date` and `saved_date` frontmatter keys are used by the auto-delete feature to determine which articles to remove.


## Development

- Clone this repository
- Install dependencies with `npm i` or `yarn`
- Start development mode with `npm run dev`

## License

[MIT](LICENSE)

## Acknowledgments

This plugin is inspired by the implementation of [joethei/obsidian-rss](https://github.com/joethei/obsidian-rss).
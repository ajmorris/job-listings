# Job Listings - Features

## Features

### Searching Monster.com
- **Stability**: planned
- **Description**: Use the existing new scraper: [monster-scraper](https://apify.com/memo23/monster-scraper) to search for job listings on Monster.com.
- **Properties**:
  - **Job Titles**: Fetch unique job titles from the `job_titles` table to determine search queries.
  - **Deduplication**: Use `external_id` format `monster_{job_id}` to prevent duplicates during Supabase upserts (onConflict: `external_id`).
  - **Schema Alignment**: Map data to the universal `jobs` table schema including `title`, `company`, `location`, `description`, `url`, and `salary`.
  - **Data Processing**: Truncate `description` fields to 5000 characters to ensure database compatibility.
  - **Sync Frequency**: Align with existing scrapers (e.g., twice daily at 8 AM & 6 PM UTC) or maintain once-daily sync if preferred, ensuring results are combined with Indeed and LinkedIn data.
  - **Efficiency**: If multiple users subscribe to the same job title, run the scraper once per title and distribute results to all relevant subscribers.
- **Test Criteria**:
  - [ ] Scraper fetches unique titles from `job_titles` table.
  - [ ] Data maps correctly to universal schema with description truncation.
  - [ ] Deduplication works via `external_id` (no duplicate entries in `jobs` table).
  - [ ] Monster.com jobs are successfully included in the `send_daily_emails.py` execution.

<!-- ### User Authentication
- **Stability**: stable
- **Description**: Secure login system with JWT tokens
- **Properties**:
  - Passwords are hashed with bcrypt (salt rounds >= 10)
  - Session tokens expire after 24 hours
  - Failed logins rate-limited to 5 per minute
- **Test Criteria**:
  - [x] Valid credentials return JWT token
  - [x] Invalid credentials return 401
  - [x] Rate limiting blocks excessive attempts -->

<!-- ### Real-time Notifications
- **Stability**: in-progress
- **Description**: Push notifications via WebSocket
- **Properties**:
  - Messages delivered within 100ms
  - Reconnection with exponential backoff
- **Test Criteria**:
  - [x] WebSocket connection established
  - [ ] Offline queue syncs on reconnect

### AI Suggestions
- **Stability**: planned
- **Description**: AI-powered recommendations
- **Properties**:
  - Analyzes user patterns
  - Provides ranked suggestions
- **Test Criteria**:
  - [ ] Endpoint returns suggestions
  - [ ] Feedback updates model -->




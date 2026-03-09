# CS Lab System Management

A powerful, standalone web application for managing Computer Science Department labs, systems, and complaints. Optimized for local use with **LocalStorage persistence** and **Export/Import capabilities**.

## Tech Stack

- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript (ES Modules)
- **Database**: `localStorage` (Custom `db.js` engine mimics Supabase API)
- **Persistence**: Manual Export/Import to JSON for cross-browser synchronization.
- **Deployment**: Vercel (Static Hosting)

## Setup Instructions

1. **Run Locally**:
    - Open `index.html` in a local server (e.g., Live Server, `python3 -m http.server`).
    - Access the app at `http://localhost:8000`.

2. **Initial Access**:
    - **Admin Login**: `admin@test.com` (Password: any)
    - **Sign Up**: Create new accounts as Student or Committee members.

3. **Data Persistence**:
    - Data is stored in your browser.
    - **Recommended**: Periodically use the **Export Backup** button in the Admin Dashboard to save your data as a JSON file.
    - Use **Import Backup** on any new device/browser to restore your data.

## Features

- **Admin**:
  - Create and manage Lab Grids (Rows × Columns).
  - Assign physical systems to specific grid cells.
  - **Data Management**: Export/Import the entire system database as JSON.
- **Committee**:
  - Visual Lab Overview arranged by grid layout.
  - Review, assign, and resolve student complaints.
  - Update system status (Working, In-Progress, Waiting, etc.).
- **Student**:
  - Visual Reporting: Click on the specific PC in the lab grid to report an issue.
  - Track personal report history and resolution notes.

## Production Deployment & Cloud Database

To deploy this in a college-wide environment, follow these steps to set up a cloud database via **Supabase** (Free Tier).

### 1. Supabase Setup

1. Create a free project at [Supabase](https://supabase.com/).
2. Go to the **SQL Editor** and run the following script to create the required tables:

```sql
-- Profiles table for users
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique,
  full_name text,
  role text check (role in ('admin', 'committee', 'student')),
  roll_number text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Labs table
create table labs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  total_rows int default 5,
  total_cols int default 5,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Systems table
create table systems (
  id uuid default gen_random_uuid() primary key,
  lab_id uuid references labs(id) on delete cascade,
  serial_number text not null,
  brand text,
  model text,
  status text default 'working',
  position_row int,
  position_col int,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Complaints table
create table complaints (
  id uuid default gen_random_uuid() primary key,
  system_id uuid references systems(id) on delete cascade,
  student_id uuid references profiles(id),
  issue_type text,
  description text,
  status text default 'pending',
  resolution_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) - Basic Policy: Allow all for now
alter table profiles enable row level security;
alter table labs enable row level security;
alter table systems enable row level security;
alter table complaints enable row level security;

create policy "Public Access" on profiles for all using (true);
create policy "Public Access" on labs for all using (true);
create policy "Public Access" on systems for all using (true);
create policy "Public Access" on complaints for all using (true);
```

### 2. Connect the App

In your deployment environment (or locally for testing), you need to define your Supabase credentials.

Add the following script tag to your `index.html` (or a global config file) **before** any other script imports:

```html
<script>
  window.SUPABASE_CONFIG = {
    url: 'YOUR_SUPABASE_URL',
    key: 'YOUR_SUPABASE_ANON_KEY'
  };
</script>
```

### 3. Deploy to Vercel

1. Push your code to GitHub.
2. Connect your repo to [Vercel](https://vercel.com/).
3. The `vercel.json` is already configured for static routing.

## Features Added for College Deployment

- **CSV Health Reports**: Export system status directly from the Admin > Manage Systems page.
- **Cloud Persistence**: Integrated Supabase support for multi-user, multi-device synchronization.

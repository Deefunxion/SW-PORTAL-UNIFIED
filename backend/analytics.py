#!/usr/bin/env python3
"""
SW Portal Analytics Module
Provides comprehensive analytics and statistics for the portal
"""

import os
import json
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from flask import request, jsonify, current_app
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from auth import admin_required, staff_required, get_current_user_info

class AnalyticsManager:
    """Analytics and statistics manager"""
    
    def __init__(self, db):
        self.db = db
    
    def create_analytics_tables(self):
        """Create analytics-related tables if they don't exist"""
        try:
            with self.db.engine.connect() as conn:
                # Check if tables exist
                result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
                tables = [row[0] for row in result]
                
                if 'analytics_event' not in tables:
                    conn.execute(text("""
                        CREATE TABLE analytics_event (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            event_type VARCHAR(50) NOT NULL,
                            event_category VARCHAR(50) NOT NULL,
                            event_data TEXT,
                            user_id INTEGER,
                            ip_address VARCHAR(45),
                            user_agent TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES user (id)
                        )
                    """))
                    print("Created analytics_event table")
                
                if 'daily_stats' not in tables:
                    conn.execute(text("""
                        CREATE TABLE daily_stats (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            date DATE NOT NULL UNIQUE,
                            total_users INTEGER DEFAULT 0,
                            active_users INTEGER DEFAULT 0,
                            new_users INTEGER DEFAULT 0,
                            file_uploads INTEGER DEFAULT 0,
                            file_downloads INTEGER DEFAULT 0,
                            forum_posts INTEGER DEFAULT 0,
                            forum_topics INTEGER DEFAULT 0,
                            ai_queries INTEGER DEFAULT 0,
                            page_views INTEGER DEFAULT 0,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """))
                    print("Created daily_stats table")
                
                conn.commit()
                
        except Exception as e:
            print(f"Could not create analytics tables: {e}")
    
    def track_event(self, event_type, event_category, event_data=None, user_id=None, ip_address=None, user_agent=None):
        """Track an analytics event"""
        try:
            with self.db.engine.connect() as conn:
                conn.execute(text("""
                    INSERT INTO analytics_event 
                    (event_type, event_category, event_data, user_id, ip_address, user_agent)
                    VALUES (?, ?, ?, ?, ?, ?)
                """), (event_type, event_category, json.dumps(event_data) if event_data else None, 
                     user_id, ip_address, user_agent))
                conn.commit()
                
        except Exception as e:
            print(f"Analytics tracking error: {e}")
    
    def update_daily_stats(self, date=None):
        """Update daily statistics for a specific date"""
        if not date:
            date = datetime.now().date()
        
        try:
            with self.db.engine.connect() as conn:
                # Get user statistics
                total_users = conn.execute(text("SELECT COUNT(*) FROM user")).fetchone()[0]
                
                # Active users (logged in today)
                active_users = conn.execute(
                    text("""
                        SELECT COUNT(DISTINCT user_id) FROM analytics_event 
                        WHERE DATE(created_at) = :date AND event_type = 'login'
                    """),
                    {"date": date}
                ).fetchone()[0]
                
                # New users (registered today)
                new_users = conn.execute(
                    text("""
                        SELECT COUNT(*) FROM user 
                        WHERE DATE(created_at) = :date
                    """),
                    {"date": date}
                ).fetchone()[0]
                
                # File statistics
                file_uploads = conn.execute(
                    text("""
                        SELECT COUNT(*) FROM analytics_event 
                        WHERE DATE(created_at) = :date AND event_type = 'file_upload'
                    """),
                    {"date": date}
                ).fetchone()[0]
                
                file_downloads = conn.execute(
                    text("""
                        SELECT COUNT(*) FROM analytics_event 
                        WHERE DATE(created_at) = :date AND event_type = 'file_download'
                    """),
                    {"date": date}
                ).fetchone()[0]
                
                # Forum statistics
                forum_posts = conn.execute(
                    text("""
                        SELECT COUNT(*) FROM analytics_event 
                        WHERE DATE(created_at) = :date AND event_type = 'forum_post'
                    """),
                    {"date": date}
                ).fetchone()[0]
                
                forum_topics = conn.execute(
                    text("""
                        SELECT COUNT(*) FROM analytics_event 
                        WHERE DATE(created_at) = :date AND event_type = 'forum_topic'
                    """),
                    {"date": date}
                ).fetchone()[0]
                
                # AI Assistant statistics
                ai_queries = conn.execute(
                    text("""
                        SELECT COUNT(*) FROM analytics_event 
                        WHERE DATE(created_at) = :date AND event_type = 'ai_query'
                    """),
                    {"date": date}
                ).fetchone()[0]
                
                # Page views
                page_views = conn.execute(
                    text("""
                        SELECT COUNT(*) FROM analytics_event 
                        WHERE DATE(created_at) = :date AND event_type = 'page_view'
                    """),
                    {"date": date}
                ).fetchone()[0]
                
                # Insert or update daily stats
                conn.execute(text("""
                    INSERT OR REPLACE INTO daily_stats 
                    (date, total_users, active_users, new_users, file_uploads, file_downloads, 
                     forum_posts, forum_topics, ai_queries, page_views)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """), (date, total_users, active_users, new_users, file_uploads, file_downloads,
                     forum_posts, forum_topics, ai_queries, page_views))
                
                conn.commit()
                
        except Exception as e:
            print(f"Daily stats update error: {e}")
    
    def get_dashboard_stats(self, days=30):
        """Get dashboard statistics for the last N days"""
        try:
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=days-1)
            
            with self.db.engine.connect() as conn:
                # Get daily stats
                daily_stats = conn.execute(text("""
                    SELECT * FROM daily_stats 
                    WHERE date >= ? AND date <= ?
                    ORDER BY date ASC
                """), (start_date, end_date)).fetchall()
                
                # Convert to list of dicts
                stats_data = []
                for row in daily_stats:
                    stats_data.append({
                        'date': row[1].strftime('%Y-%m-%d') if row[1] else None,
                        'total_users': row[2] or 0,
                        'active_users': row[3] or 0,
                        'new_users': row[4] or 0,
                        'file_uploads': row[5] or 0,
                        'file_downloads': row[6] or 0,
                        'forum_posts': row[7] or 0,
                        'forum_topics': row[8] or 0,
                        'ai_queries': row[9] or 0,
                        'page_views': row[10] or 0
                    })
                
                # Get current totals
                current_stats = conn.execute(text("""
                    SELECT 
                        COUNT(*) as total_users,
                        (SELECT COUNT(*) FROM discussion) as total_discussions,
                        (SELECT COUNT(*) FROM post) as total_posts,
                        (SELECT COUNT(*) FROM analytics_event WHERE event_type = 'file_upload') as total_uploads,
                        (SELECT COUNT(*) FROM analytics_event WHERE event_type = 'ai_query') as total_ai_queries
                    FROM user
                """)).fetchone()
                
                # Get top file categories
                file_categories = conn.execute(text("""
                    SELECT 
                        JSON_EXTRACT(event_data, '$.category') as category,
                        COUNT(*) as count
                    FROM analytics_event 
                    WHERE event_type = 'file_download' 
                        AND JSON_EXTRACT(event_data, '$.category') IS NOT NULL
                        AND created_at >= ?
                    GROUP BY category
                    ORDER BY count DESC
                    LIMIT 10
                """), (start_date,)).fetchall()
                
                # Get user activity by hour
                hourly_activity = conn.execute(text("""
                    SELECT 
                        strftime('%H', created_at) as hour,
                        COUNT(*) as activity_count
                    FROM analytics_event 
                    WHERE created_at >= ?
                    GROUP BY hour
                    ORDER BY hour
                """), (start_date,)).fetchall()
                
                # Get most active users
                active_users = conn.execute(text("""
                    SELECT 
                        u.username,
                        COUNT(ae.id) as activity_count
                    FROM user u
                    LEFT JOIN analytics_event ae ON u.id = ae.user_id
                    WHERE ae.created_at >= ?
                    GROUP BY u.id, u.username
                    ORDER BY activity_count DESC
                    LIMIT 10
                """), (start_date,)).fetchall()
                
                return {
                    'daily_stats': stats_data,
                    'current_totals': {
                        'total_users': current_stats[0] or 0,
                        'total_discussions': current_stats[1] or 0,
                        'total_posts': current_stats[2] or 0,
                        'total_uploads': current_stats[3] or 0,
                        'total_ai_queries': current_stats[4] or 0
                    },
                    'file_categories': [{'category': row[0], 'count': row[1]} for row in file_categories],
                    'hourly_activity': [{'hour': int(row[0]), 'count': row[1]} for row in hourly_activity],
                    'active_users': [{'username': row[0], 'activity': row[1]} for row in active_users]
                }
                
        except Exception as e:
            print(f"Dashboard stats error: {e}")
            return {
                'daily_stats': [],
                'current_totals': {},
                'file_categories': [],
                'hourly_activity': [],
                'active_users': []
            }
    
    def get_user_analytics(self, user_id, days=30):
        """Get analytics for a specific user"""
        try:
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=days-1)
            
            with self.db.engine.connect() as conn:
                # User activity by type
                activity_by_type = conn.execute(text("""
                    SELECT 
                        event_type,
                        COUNT(*) as count
                    FROM analytics_event 
                    WHERE user_id = ? AND created_at >= ?
                    GROUP BY event_type
                    ORDER BY count DESC
                """), (user_id, start_date)).fetchall()
                
                # Daily activity
                daily_activity = conn.execute(text("""
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as activity_count
                    FROM analytics_event 
                    WHERE user_id = ? AND created_at >= ?
                    GROUP BY DATE(created_at)
                    ORDER BY date ASC
                """), (user_id, start_date)).fetchall()
                
                return {
                    'activity_by_type': [{'type': row[0], 'count': row[1]} for row in activity_by_type],
                    'daily_activity': [{'date': row[0], 'count': row[1]} for row in daily_activity]
                }
                
        except Exception as e:
            print(f"User analytics error: {e}")
            return {'activity_by_type': [], 'daily_activity': []}

def init_analytics(app, db):
    """Initialize analytics system"""
    analytics_manager = AnalyticsManager(db)
    analytics_manager.create_analytics_tables()
    
    # Update today's stats
    analytics_manager.update_daily_stats()
    
    print("Analytics system initialized")
    return analytics_manager

def create_analytics_routes(app, db, analytics_manager):
    """Create analytics routes"""
    
    @app.route('/api/analytics/dashboard', methods=['GET'])
    @staff_required
    def get_dashboard_analytics():
        """Get dashboard analytics (staff only)"""
        days = request.args.get('days', 30, type=int)
        stats = analytics_manager.get_dashboard_stats(days)
        return jsonify(stats)
    
    @app.route('/api/analytics/user/<int:user_id>', methods=['GET'])
    @staff_required
    def get_user_analytics(user_id):
        """Get user-specific analytics (staff only)"""
        days = request.args.get('days', 30, type=int)
        stats = analytics_manager.get_user_analytics(user_id, days)
        return jsonify(stats)
    
    @app.route('/api/analytics/track', methods=['POST'])
    def track_analytics_event():
        """Track an analytics event"""
        data = request.get_json()
        
        user_info = None
        try:
            user_info = get_current_user_info()
        except:
            pass  # Anonymous tracking allowed
        
        analytics_manager.track_event(
            event_type=data.get('event_type'),
            event_category=data.get('event_category'),
            event_data=data.get('event_data'),
            user_id=user_info['id'] if user_info else None,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        return jsonify({'message': 'Event tracked successfully'})
    
    @app.route('/api/analytics/stats/update', methods=['POST'])
    @admin_required
    def update_daily_stats():
        """Manually update daily statistics (admin only)"""
        date_str = request.json.get('date') if request.json else None
        date = datetime.strptime(date_str, '%Y-%m-%d').date() if date_str else None
        
        analytics_manager.update_daily_stats(date)
        
        return jsonify({'message': 'Daily stats updated successfully'})
    
    @app.route('/api/analytics/export', methods=['GET'])
    @admin_required
    def export_analytics():
        """Export analytics data (admin only)"""
        days = request.args.get('days', 30, type=int)
        format_type = request.args.get('format', 'json')
        
        stats = analytics_manager.get_dashboard_stats(days)
        
        if format_type == 'csv':
            # Convert to CSV format
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write headers
            writer.writerow(['Date', 'Total Users', 'Active Users', 'New Users', 
                           'File Uploads', 'File Downloads', 'Forum Posts', 
                           'Forum Topics', 'AI Queries', 'Page Views'])
            
            # Write data
            for day_stat in stats['daily_stats']:
                writer.writerow([
                    day_stat['date'],
                    day_stat['total_users'],
                    day_stat['active_users'],
                    day_stat['new_users'],
                    day_stat['file_uploads'],
                    day_stat['file_downloads'],
                    day_stat['forum_posts'],
                    day_stat['forum_topics'],
                    day_stat['ai_queries'],
                    day_stat['page_views']
                ])
            
            output.seek(0)
            return output.getvalue(), 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename=sw_portal_analytics_{datetime.now().strftime("%Y%m%d")}.csv'
            }
        
        return jsonify(stats)
    
    print("Analytics routes created")


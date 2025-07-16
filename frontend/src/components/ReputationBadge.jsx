import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { 
  Star, 
  TrendingUp, 
  MessageSquare, 
  Heart, 
  Award,
  Crown,
  Shield,
  Zap
} from 'lucide-react';
import api from '@/lib/api';

/**
 * User Reputation Badge Component
 * Displays user reputation score and level
 */
function ReputationBadge({ 
  userId, 
  username, 
  reputation = null, 
  size = 'sm', 
  showDetails = false,
  className = '' 
}) {
  const [reputationData, setReputationData] = useState(reputation);
  const [loading, setLoading] = useState(!reputation);

  useEffect(() => {
    if (!reputation && userId) {
      fetchReputation();
    }
  }, [userId, reputation]);

  const fetchReputation = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/users/${userId}/reputation`);
      setReputationData(data.reputation);
    } catch (error) {
      console.error('Error fetching reputation:', error);
      setReputationData({
        reputation_score: 0,
        posts_count: 0,
        likes_received: 0,
        comments_count: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const getReputationLevel = (score) => {
    if (score >= 1000) return { level: 'Legendary', icon: Crown, color: 'text-yellow-500', bgColor: 'bg-yellow-50' };
    if (score >= 500) return { level: 'Expert', icon: Award, color: 'text-purple-500', bgColor: 'bg-purple-50' };
    if (score >= 200) return { level: 'Advanced', icon: Shield, color: 'text-blue-500', bgColor: 'bg-blue-50' };
    if (score >= 50) return { level: 'Intermediate', icon: Zap, color: 'text-green-500', bgColor: 'bg-green-50' };
    if (score >= 10) return { level: 'Beginner', icon: Star, color: 'text-orange-500', bgColor: 'bg-orange-50' };
    return { level: 'Newcomer', icon: MessageSquare, color: 'text-gray-500', bgColor: 'bg-gray-50' };
  };

  if (loading) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className="animate-pulse bg-gray-200 rounded h-5 w-16"></div>
      </div>
    );
  }

  if (!reputationData) {
    return null;
  }

  const score = reputationData.reputation_score || 0;
  const levelInfo = getReputationLevel(score);
  const Icon = levelInfo.icon;

  if (size === 'xs') {
    return (
      <Badge 
        variant="secondary" 
        className={`inline-flex items-center space-x-1 ${levelInfo.bgColor} ${levelInfo.color} border-0 ${className}`}
      >
        <Icon className="h-3 w-3" />
        <span className="text-xs font-medium">{score}</span>
      </Badge>
    );
  }

  if (size === 'sm') {
    return (
      <div className={`inline-flex items-center space-x-2 ${className}`}>
        <Badge 
          variant="secondary" 
          className={`inline-flex items-center space-x-1 ${levelInfo.bgColor} ${levelInfo.color} border-0`}
        >
          <Icon className="h-3 w-3" />
          <span className="text-xs font-medium">{score}</span>
        </Badge>
        {showDetails && (
          <span className="text-xs text-gray-500">{levelInfo.level}</span>
        )}
      </div>
    );
  }

  if (size === 'lg' || showDetails) {
    return (
      <Card className={`w-full max-w-sm ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Icon className={`h-5 w-5 ${levelInfo.color}`} />
            <span>{username || 'User'}</span>
            <Badge 
              variant="secondary" 
              className={`${levelInfo.bgColor} ${levelInfo.color} border-0`}
            >
              {levelInfo.level}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Reputation Score */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Φήμη</span>
              <div className="flex items-center space-x-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="font-semibold">{score}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="font-medium">{reputationData.posts_count || 0}</div>
                  <div className="text-xs text-gray-500">Δημοσιεύσεις</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Heart className="h-4 w-4 text-red-500" />
                <div>
                  <div className="font-medium">{reputationData.likes_received || 0}</div>
                  <div className="text-xs text-gray-500">Likes</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 text-green-500" />
                <div>
                  <div className="font-medium">{reputationData.comments_count || 0}</div>
                  <div className="text-xs text-gray-500">Σχόλια</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <div>
                  <div className="font-medium">{reputationData.likes_given || 0}</div>
                  <div className="text-xs text-gray-500">Έδωσε</div>
                </div>
              </div>
            </div>

            {/* Progress to next level */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Πρόοδος</span>
                <span>{getNextLevelProgress(score)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full ${levelInfo.color.replace('text-', 'bg-')}`}
                  style={{ width: `${getProgressPercentage(score)}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Badge 
      variant="secondary" 
      className={`inline-flex items-center space-x-1 ${levelInfo.bgColor} ${levelInfo.color} border-0 ${className}`}
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{score}</span>
      {showDetails && <span className="ml-1">• {levelInfo.level}</span>}
    </Badge>
  );
}

/**
 * Calculate progress to next reputation level
 */
function getNextLevelProgress(score) {
  const levels = [
    { min: 0, max: 10, name: 'Newcomer' },
    { min: 10, max: 50, name: 'Beginner' },
    { min: 50, max: 200, name: 'Intermediate' },
    { min: 200, max: 500, name: 'Advanced' },
    { min: 500, max: 1000, name: 'Expert' },
    { min: 1000, max: Infinity, name: 'Legendary' }
  ];

  const currentLevel = levels.find(level => score >= level.min && score < level.max);
  if (!currentLevel || currentLevel.max === Infinity) {
    return 'Max Level';
  }

  const needed = currentLevel.max - score;
  return `${needed} για ${levels[levels.indexOf(currentLevel) + 1]?.name}`;
}

/**
 * Calculate progress percentage to next level
 */
function getProgressPercentage(score) {
  const levels = [
    { min: 0, max: 10 },
    { min: 10, max: 50 },
    { min: 50, max: 200 },
    { min: 200, max: 500 },
    { min: 500, max: 1000 }
  ];

  const currentLevel = levels.find(level => score >= level.min && score < level.max);
  if (!currentLevel) {
    return 100; // Max level
  }

  const progress = (score - currentLevel.min) / (currentLevel.max - currentLevel.min);
  return Math.round(progress * 100);
}

/**
 * Reputation Leaderboard Component
 */
function ReputationLeaderboard({ limit = 10, className = '' }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [limit]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/users/leaderboard?limit=${limit}`);
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Award className="h-5 w-5" />
            <span>Κατάταξη Φήμης</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center space-x-3">
                <div className="bg-gray-200 rounded-full h-8 w-8"></div>
                <div className="flex-1 bg-gray-200 rounded h-4"></div>
                <div className="bg-gray-200 rounded h-4 w-12"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Award className="h-5 w-5 text-yellow-500" />
          <span>Κατάταξη Φήμης</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leaderboard.map((entry, index) => {
            const levelInfo = getReputationLevel(entry.reputation.reputation_score);
            const Icon = levelInfo.icon;
            
            return (
              <div key={entry.user.id} className="flex items-center space-x-3">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                  ${index === 0 ? 'bg-yellow-100 text-yellow-800' : 
                    index === 1 ? 'bg-gray-100 text-gray-800' : 
                    index === 2 ? 'bg-orange-100 text-orange-800' : 
                    'bg-blue-100 text-blue-800'}
                `}>
                  {entry.rank}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium truncate">{entry.user.username}</span>
                    <Icon className={`h-4 w-4 ${levelInfo.color}`} />
                  </div>
                  <div className="text-xs text-gray-500">
                    {entry.reputation.posts_count} δημοσιεύσεις • {entry.reputation.likes_received} likes
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-semibold">{entry.reputation.reputation_score}</div>
                  <div className="text-xs text-gray-500">{levelInfo.level}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default ReputationBadge;
export { ReputationLeaderboard };


"""
GitHub Skill Profile Analyzer
Analyzes GitHub contributions to generate structured skill profiles.
"""
import requests
import math
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)


class GitHubSkillAnalyzer:
    """Analyzes GitHub profile to extract skill information"""

    # Recency weights (5-year window)
    RECENCY_WEIGHTS = {
        'months_0_6': 1.0,
        'months_6_12': 0.8,
        'years_1_2': 0.5,
        'years_2_3': 0.3,
        'years_3_5': 0.1,
    }

    # Star count multipliers (log scale)
    STAR_MULTIPLIERS = [
        (10000, 4.0),
        (1000, 3.0),
        (100, 2.0),
        (0, 1.0),
    ]

    # Contributor count multipliers
    CONTRIBUTOR_MULTIPLIERS = [
        (100, 2.5),
        (20, 2.0),
        (5, 1.5),
        (0, 1.0),
    ]

    # Domain tag patterns (repo topics and dependency files)
    DOMAIN_PATTERNS = {
        'machine-learning': ['tensorflow', 'pytorch', 'keras', 'scikit-learn', 'ml', 'deep-learning'],
        'nlp': ['nlp', 'natural-language', 'transformers', 'spacy', 'nltk'],
        'computer-vision': ['opencv', 'vision', 'image-processing', 'detection'],
        'data-engineering': ['airflow', 'spark', 'kafka', 'etl', 'pipeline'],
        'web-frontend': ['react', 'vue', 'angular', 'typescript', 'frontend', 'ui'],
        'web-backend': ['django', 'flask', 'fastapi', 'express', 'node', 'backend', 'api'],
        'mobile': ['ios', 'android', 'react-native', 'flutter', 'mobile'],
        'devops': ['docker', 'kubernetes', 'ci-cd', 'terraform', 'aws', 'devops'],
        'data-science': ['pandas', 'numpy', 'jupyter', 'data-analysis', 'statistics'],
        'blockchain': ['blockchain', 'ethereum', 'solidity', 'crypto', 'web3'],
    }

    def __init__(self, github_token: str):
        """Initialize with GitHub personal access token"""
        self.token = github_token
        self.headers = {
            'Authorization': f'Bearer {github_token}',
            'Content-Type': 'application/json',
        }

    def analyze_profile(self, github_username: str) -> Dict:
        """
        Main entry point: analyze a GitHub profile and return skill data

        Returns:
            {
                'top_languages': [{language, score, evidence_summary}, ...],
                'domain_tags': ['machine-learning', 'web-backend', ...],
                'credibility_tier': 1-3,
                'total_score': float,
                'collaboration_ratio': 0.0-1.0,
                'notable_contributions': [{...}, ...],
            }
        """
        try:
            # Fetch GitHub data
            user_data = self._fetch_user_data(github_username)
            repos = self._fetch_user_repos(github_username)
            pull_requests = self._fetch_user_pull_requests(github_username)

            # Calculate scores
            language_scores = self._calculate_language_scores(repos, pull_requests)
            domain_tags = self._extract_domain_tags(repos, pull_requests)
            collaboration_ratio = self._calculate_collaboration_ratio(repos, pull_requests)
            notable_contribs = self._find_notable_contributions(pull_requests)

            # Calculate total score and tier
            total_score = sum(score for _, score, _ in language_scores[:10])  # Top 10 languages
            credibility_tier = self._calculate_tier(total_score)

            # Format top languages
            top_languages = [
                {
                    'language': lang,
                    'score': round(score, 2),
                    'evidence_summary': evidence
                }
                for lang, score, evidence in language_scores[:10]
            ]

            return {
                'top_languages': top_languages,
                'domain_tags': domain_tags,
                'credibility_tier': credibility_tier,
                'total_score': round(total_score, 2),
                'collaboration_ratio': round(collaboration_ratio, 2),
                'notable_contributions': notable_contribs[:5],
            }

        except Exception as e:
            logger.error(f"Error analyzing GitHub profile for {github_username}: {e}")
            raise

    def _fetch_user_data(self, username: str) -> Dict:
        """Fetch basic user profile data from GitHub REST API"""
        url = f'https://api.github.com/users/{username}'
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def _fetch_user_repos(self, username: str) -> List[Dict]:
        """Fetch user's repositories with language data"""
        repos = []
        page = 1
        while page <= 5:  # Limit to first 5 pages (500 repos max)
            url = f'https://api.github.com/users/{username}/repos?page={page}&per_page=100&sort=updated'
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            batch = response.json()
            if not batch:
                break
            repos.extend(batch)
            page += 1
        return repos

    def _fetch_user_pull_requests(self, username: str) -> List[Dict]:
        """Fetch user's pull requests using GitHub Search API"""
        # Search for PRs authored by user
        query = f'author:{username} type:pr'
        url = f'https://api.github.com/search/issues?q={query}&sort=updated&per_page=100'

        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        data = response.json()
        return data.get('items', [])[:100]  # Limit to 100 most recent PRs

    def _calculate_recency_weight(self, date_str: str) -> float:
        """Calculate recency weight based on how old the contribution is"""
        try:
            contrib_date = datetime.strptime(date_str[:10], '%Y-%m-%d')
            now = datetime.now()
            delta = now - contrib_date

            if delta.days <= 180:  # 0-6 months
                return self.RECENCY_WEIGHTS['months_0_6']
            elif delta.days <= 365:  # 6-12 months
                return self.RECENCY_WEIGHTS['months_6_12']
            elif delta.days <= 730:  # 1-2 years
                return self.RECENCY_WEIGHTS['years_1_2']
            elif delta.days <= 1095:  # 2-3 years
                return self.RECENCY_WEIGHTS['years_2_3']
            elif delta.days <= 1825:  # 3-5 years
                return self.RECENCY_WEIGHTS['years_3_5']
            else:
                return 0.05  # Older than 5 years still gets minimal credit
        except:
            return 0.5  # Default if date parsing fails

    def _get_repo_quality_multiplier(self, stars: int, contributors: int) -> float:
        """Calculate repository quality multiplier based on stars and contributors"""
        # Star multiplier
        star_mult = 1.0
        for threshold, multiplier in self.STAR_MULTIPLIERS:
            if stars >= threshold:
                star_mult = multiplier
                break

        # Contributor multiplier
        contrib_mult = 1.0
        for threshold, multiplier in self.CONTRIBUTOR_MULTIPLIERS:
            if contributors >= threshold:
                contrib_mult = multiplier
                break

        # Combine (geometric mean to avoid extreme values)
        return math.sqrt(star_mult * contrib_mult)

    def _calculate_language_scores(self, repos: List[Dict], prs: List[Dict]) -> List[Tuple[str, float, str]]:
        """
        Calculate weighted scores for each language
        Returns: List of (language, score, evidence_summary) tuples, sorted by score
        """
        language_scores = defaultdict(lambda: {'score': 0.0, 'external_prs': 0, 'own_repos': 0, 'stars': 0})

        # Score from own repositories
        for repo in repos:
            if not repo.get('language'):
                continue

            lang = repo['language']
            stars = repo.get('stargazers_count', 0)
            forks = repo.get('forks_count', 0)
            updated_at = repo.get('updated_at', '')

            # Base score for having a repo in this language
            base_score = 1.0

            # Bonus for stars/forks (log scale for diminishing returns)
            validation_bonus = math.log1p(stars + forks)

            # Recency weight (repos older than 5 years get reduced weight)
            recency = self._calculate_recency_weight(updated_at)

            # Total score: base + validation bonus, weighted by recency
            score = (base_score + validation_bonus) * recency * 0.5

            language_scores[lang]['score'] += score
            language_scores[lang]['own_repos'] += 1
            language_scores[lang]['stars'] += stars

        # Score from pull requests (higher weight for external contributions)
        for pr in prs:
            # Try to infer language from PR repo (simplified - would use API call in production)
            repo_url = pr.get('repository_url', '')
            if not repo_url:
                continue

            # For MVP, assign score to detected languages
            # In production, would fetch PR details to get exact languages touched
            recency = self._calculate_recency_weight(pr.get('created_at', ''))

            # Merged PR = higher score
            if pr.get('state') == 'closed' and pr.get('pull_request', {}).get('merged_at'):
                # Assume average language (would be more precise in production)
                # This is simplified - real implementation would fetch PR files
                for lang in language_scores.keys():
                    language_scores[lang]['score'] += 2.0 * recency  # External PRs weighted higher
                    language_scores[lang]['external_prs'] += 1

        # Format results
        results = []
        for lang, data in language_scores.items():
            evidence = f"{data['own_repos']} repos, {data['external_prs']} PRs, {data['stars']} stars"
            results.append((lang, data['score'], evidence))

        # Sort by score descending
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def _extract_domain_tags(self, repos: List[Dict], prs: List[Dict]) -> List[str]:
        """Extract domain tags from repo topics and dependencies"""
        tags = set()

        for repo in repos:
            topics = repo.get('topics', [])
            for topic in topics:
                for domain, patterns in self.DOMAIN_PATTERNS.items():
                    if any(pattern in topic.lower() for pattern in patterns):
                        tags.add(domain)

        return sorted(list(tags))[:10]  # Top 10 domains

    def _calculate_collaboration_ratio(self, repos: List[Dict], prs: List[Dict]) -> float:
        """Calculate ratio of external vs solo work"""
        external_prs = len(prs)
        own_repos = len(repos)

        if own_repos == 0:
            return 1.0 if external_prs > 0 else 0.0

        ratio = external_prs / (external_prs + own_repos)
        return min(ratio, 1.0)

    def _find_notable_contributions(self, prs: List[Dict]) -> List[Dict]:
        """Find the most notable PR contributions"""
        notable = []

        for pr in prs[:10]:  # Look at top 10 most recent
            if pr.get('state') == 'closed':
                notable.append({
                    'title': pr.get('title', ''),
                    'repo': pr.get('repository_url', '').split('/')[-1] if pr.get('repository_url') else '',
                    'merged': bool(pr.get('pull_request', {}).get('merged_at')),
                    'created_at': pr.get('created_at', ''),
                })

        return notable

    def _calculate_tier(self, total_score: float) -> int:
        """Calculate credibility tier based on total score"""
        if total_score >= 100:
            return 1  # Expert
        elif total_score >= 30:
            return 2  # Proficient
        else:
            return 3  # Developing

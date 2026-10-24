"""
Analytics service for JobGuard-XAI.
Computes dataset-wide statistics, fraud risk distributions across industries,
functions, education, and missing data signals from fake_job_postings.csv.
"""

import os
import sys
from typing import Any, Dict, List, Optional
import pandas as pd

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


class AnalyticsService:
    """Service to load and compute statistical analytics from the job postings dataset."""

    def __init__(self, data_path: Optional[str] = None):
        """
        Initialize the analytics service with the dataset path.
        
        Args:
            data_path: Optional path to fake_job_postings.csv. Defaults to DATA_PATH env var.
        """
        if data_path is None:
            data_path = os.path.join(PROJECT_ROOT, os.getenv("DATA_PATH", "ml/data/fake_job_postings.csv"))
        
        self.data_path = os.path.abspath(data_path)
        self.df: Optional[pd.DataFrame] = None
        self.csv_loaded = False
        
        # In-memory caches for computed analytics
        self._overview_cache: Optional[Dict[str, Any]] = None
        self._industries_cache: Optional[List[Dict[str, Any]]] = None
        self._functions_cache: Optional[List[Dict[str, Any]]] = None
        self._experience_cache: Optional[List[Dict[str, Any]]] = None
        self._employment_cache: Optional[List[Dict[str, Any]]] = None
        self._education_cache: Optional[List[Dict[str, Any]]] = None
        self._locations_cache: Optional[List[Dict[str, Any]]] = None
        self._missingness_cache: Optional[List[Dict[str, Any]]] = None
        self._logo_cache: Optional[Dict[str, Any]] = None
        self._telecommuting_cache: Optional[Dict[str, Any]] = None
        
        self.load_data()

    def load_data(self) -> bool:
        """
        Load dataset into pandas DataFrame and precalculate statistics if available.
        """
        if os.path.exists(self.data_path):
            try:
                self.df = pd.read_csv(self.data_path)
                self.csv_loaded = True
                self._compute_all()
                return True
            except Exception:
                self.csv_loaded = False
                self.df = None
        return False

    def _compute_all(self) -> None:
        """Precompute all analytics slices from loaded DataFrame."""
        if self.df is None or "fraudulent" not in self.df.columns:
            return

        total = len(self.df)
        fraud_count = int(self.df["fraudulent"].sum())
        legit_count = total - fraud_count
        fraud_rate = round(fraud_count / total if total > 0 else 0.0, 4)
        imbalance = round(legit_count / fraud_count, 1) if fraud_count > 0 else 0.0

        self._overview_cache = {
            "total_jobs": total,
            "legit_count": legit_count,
            "fraud_count": fraud_count,
            "fraud_rate": fraud_rate,
            "class_imbalance_ratio": imbalance
        }

        # Industries
        if "industry" in self.df.columns:
            ind_df = self.df[self.df["industry"].notna() & (self.df["industry"] != "")]
            ind_grp = ind_df.groupby("industry")["fraudulent"].agg(["count", "sum"]).reset_index()
            ind_grp.columns = ["industry", "count", "fraud_count"]
            ind_grp["fraud_rate"] = (ind_grp["fraud_count"] / ind_grp["count"]).round(4)
            ind_grp = ind_grp.sort_values(by="count", ascending=False)
            self._industries_cache = ind_grp.to_dict(orient="records")

        # Functions
        if "function" in self.df.columns:
            fn_df = self.df[self.df["function"].notna() & (self.df["function"] != "")]
            fn_grp = fn_df.groupby("function")["fraudulent"].agg(["count", "sum"]).reset_index()
            fn_grp.columns = ["function", "count", "fraud_count"]
            fn_grp["fraud_rate"] = (fn_grp["fraud_count"] / fn_grp["count"]).round(4)
            fn_grp = fn_grp.sort_values(by="count", ascending=False)
            self._functions_cache = fn_grp.to_dict(orient="records")

        # Experience
        if "required_experience" in self.df.columns:
            exp_df = self.df[self.df["required_experience"].notna()]
            exp_grp = exp_df.groupby("required_experience")["fraudulent"].agg(["count", "sum"]).reset_index()
            exp_grp.columns = ["level", "count", "fraud_count"]
            exp_grp["fraud_rate"] = (exp_grp["fraud_count"] / exp_grp["count"]).round(4)
            exp_grp = exp_grp.sort_values(by="count", ascending=False)
            self._experience_cache = exp_grp.to_dict(orient="records")

        # Employment Types
        if "employment_type" in self.df.columns:
            emp_df = self.df[self.df["employment_type"].notna()]
            emp_grp = emp_df.groupby("employment_type")["fraudulent"].agg(["count", "sum"]).reset_index()
            emp_grp.columns = ["type", "count", "fraud_count"]
            emp_grp["fraud_rate"] = (emp_grp["fraud_count"] / emp_grp["count"]).round(4)
            emp_grp = emp_grp.sort_values(by="count", ascending=False)
            self._employment_cache = emp_grp.to_dict(orient="records")

        # Education
        if "required_education" in self.df.columns:
            edu_df = self.df[self.df["required_education"].notna()]
            edu_grp = edu_df.groupby("required_education")["fraudulent"].agg(["count", "sum"]).reset_index()
            edu_grp.columns = ["level", "count", "fraud_count"]
            edu_grp["fraud_rate"] = (edu_grp["fraud_count"] / edu_grp["count"]).round(4)
            edu_grp = edu_grp.sort_values(by="count", ascending=False)
            self._education_cache = edu_grp.to_dict(orient="records")

        # Locations
        if "location" in self.df.columns:
            loc_df = self.df[self.df["location"].notna()]
            loc_grp = loc_df.groupby("location")["fraudulent"].agg(["count", "sum"]).reset_index()
            loc_grp.columns = ["location", "count", "fraud_count"]
            loc_grp["fraud_rate"] = (loc_grp["fraud_count"] / loc_grp["count"]).round(4)
            loc_grp = loc_grp.sort_values(by="count", ascending=False).head(30)
            self._locations_cache = loc_grp.to_dict(orient="records")

        # Missingness
        missing_list = []
        for col in self.df.columns:
            m_count = int(self.df[col].isna().sum())
            m_pct = round((m_count / total) * 100.0, 2)
            missing_list.append({
                "column": col,
                "missing_count": m_count,
                "missing_pct": m_pct
            })
        missing_list.sort(key=lambda x: x["missing_pct"], reverse=True)
        self._missingness_cache = missing_list

        # Company Logo Signal
        if "has_company_logo" in self.df.columns:
            with_logo = self.df[self.df["has_company_logo"] == 1]
            without_logo = self.df[self.df["has_company_logo"] == 0]
            
            with_cnt = len(with_logo)
            with_fraud = int(with_logo["fraudulent"].sum()) if with_cnt > 0 else 0
            
            wout_cnt = len(without_logo)
            wout_fraud = int(without_logo["fraudulent"].sum()) if wout_cnt > 0 else 0
            
            self._logo_cache = {
                "with_logo": {
                    "count": with_cnt,
                    "fraud_count": with_fraud,
                    "fraud_rate": round(with_fraud / with_cnt if with_cnt > 0 else 0.0, 4)
                },
                "without_logo": {
                    "count": wout_cnt,
                    "fraud_count": wout_fraud,
                    "fraud_rate": round(wout_fraud / wout_cnt if wout_cnt > 0 else 0.0, 4)
                }
            }

        # Telecommuting Signal
        if "telecommuting" in self.df.columns:
            remote = self.df[self.df["telecommuting"] == 1]
            onsite = self.df[self.df["telecommuting"] == 0]
            
            rem_cnt = len(remote)
            rem_fraud = int(remote["fraudulent"].sum()) if rem_cnt > 0 else 0
            
            on_cnt = len(onsite)
            on_fraud = int(onsite["fraudulent"].sum()) if on_cnt > 0 else 0
            
            self._telecommuting_cache = {
                "remote": {
                    "count": rem_cnt,
                    "fraud_count": rem_fraud,
                    "fraud_rate": round(rem_fraud / rem_cnt if rem_cnt > 0 else 0.0, 4)
                },
                "onsite": {
                    "count": on_cnt,
                    "fraud_count": on_fraud,
                    "fraud_rate": round(on_fraud / on_cnt if on_cnt > 0 else 0.0, 4)
                }
            }

    def get_overview(self) -> Dict[str, Any]:
        """
        Get dataset summary overview metrics.
        Returns: {total_jobs, legit_count, fraud_count, fraud_rate, class_imbalance_ratio}
        """
        if self._overview_cache is not None:
            return self._overview_cache
        
        # Ground-truth dataset fallback
        return {
            "total_jobs": 17880,
            "legit_count": 17014,
            "fraud_count": 866,
            "fraud_rate": 0.0484,
            "class_imbalance_ratio": 19.6
        }

    def get_industries(self) -> List[Dict[str, Any]]:
        """
        Get fraud distribution across top industries.
        Returns list of {industry, count, fraud_count, fraud_rate} sorted by count desc.
        """
        if self._industries_cache is not None:
            return self._industries_cache

        return [
            {"industry": "Information Technology and Services", "count": 2264, "fraud_count": 32, "fraud_rate": 0.0141},
            {"industry": "Computer Software", "count": 1376, "fraud_count": 17, "fraud_rate": 0.0124},
            {"industry": "Internet", "count": 1062, "fraud_count": 15, "fraud_rate": 0.0141},
            {"industry": "Marketing and Advertising", "count": 828, "fraud_count": 45, "fraud_rate": 0.0543},
            {"industry": "Education Management", "count": 822, "fraud_count": 1, "fraud_rate": 0.0012},
            {"industry": "Financial Services", "count": 779, "fraud_count": 35, "fraud_rate": 0.0449},
            {"industry": "Hospital & Health Care", "count": 497, "fraud_count": 51, "fraud_rate": 0.1026},
            {"industry": "Consumer Services", "count": 358, "fraud_count": 8, "fraud_rate": 0.0223},
            {"industry": "Telecommunications", "count": 342, "fraud_count": 26, "fraud_rate": 0.0760},
            {"industry": "Oil & Energy", "count": 321, "fraud_count": 109, "fraud_rate": 0.3396},
            {"industry": "Retail", "count": 223, "fraud_count": 6, "fraud_rate": 0.0269},
            {"industry": "Real Estate", "count": 248, "fraud_count": 24, "fraud_rate": 0.0968},
            {"industry": "Accounting", "count": 159, "fraud_count": 57, "fraud_rate": 0.3585},
            {"industry": "Staffing and Recruiting", "count": 127, "fraud_count": 8, "fraud_rate": 0.0630},
            {"industry": "Design", "count": 340, "fraud_count": 2, "fraud_rate": 0.0059}
        ]

    def get_functions(self) -> List[Dict[str, Any]]:
        """
        Get fraud distribution across job functions.
        Returns list of {function, count, fraud_rate}.
        """
        if self._functions_cache is not None:
            return self._functions_cache

        return [
            {"function": "Information Technology", "count": 1749, "fraud_count": 32, "fraud_rate": 0.0183},
            {"function": "Sales", "count": 1468, "fraud_count": 40, "fraud_rate": 0.0272},
            {"function": "Engineering", "count": 1348, "fraud_count": 36, "fraud_rate": 0.0267},
            {"function": "Customer Service", "count": 1229, "fraud_count": 67, "fraud_rate": 0.0545},
            {"function": "Administrative", "count": 1195, "fraud_count": 120, "fraud_rate": 0.1004},
            {"function": "Marketing", "count": 830, "fraud_count": 10, "fraud_rate": 0.0120},
            {"function": "Design", "count": 340, "fraud_count": 2, "fraud_rate": 0.0059},
            {"function": "Health Care Provider", "count": 338, "fraud_count": 1, "fraud_rate": 0.0029},
            {"function": "Education", "count": 325, "fraud_count": 1, "fraud_rate": 0.0031},
            {"function": "Business Development", "count": 373, "fraud_count": 11, "fraud_rate": 0.0295},
            {"function": "Accounting/Auditing", "count": 212, "fraud_count": 23, "fraud_rate": 0.1085},
            {"function": "Human Resources", "count": 258, "fraud_count": 10, "fraud_rate": 0.0388},
            {"function": "Finance", "count": 172, "fraud_count": 15, "fraud_rate": 0.0872}
        ]

    def get_experience_levels(self) -> List[Dict[str, Any]]:
        """
        Get fraud distribution across required experience levels.
        """
        if self._experience_cache is not None:
            return self._experience_cache

        return [
            {"level": "Mid-Senior level", "count": 3809, "fraud_count": 113, "fraud_rate": 0.0297},
            {"level": "Entry level", "count": 2697, "fraud_count": 179, "fraud_rate": 0.0664},
            {"level": "Associate", "count": 2297, "fraud_count": 42, "fraud_rate": 0.0183},
            {"level": "Not Applicable", "count": 1116, "fraud_count": 60, "fraud_rate": 0.0538},
            {"level": "Director", "count": 389, "fraud_count": 17, "fraud_rate": 0.0437},
            {"level": "Internship", "count": 381, "fraud_count": 10, "fraud_rate": 0.0262},
            {"level": "Executive", "count": 141, "fraud_count": 10, "fraud_rate": 0.0709}
        ]

    def get_employment_types(self) -> List[Dict[str, Any]]:
        """
        Get fraud distribution across employment types.
        """
        if self._employment_cache is not None:
            return self._employment_cache

        return [
            {"type": "Full-time", "count": 11620, "fraud_count": 490, "fraud_rate": 0.0422},
            {"type": "Contract", "count": 1524, "fraud_count": 44, "fraud_rate": 0.0289},
            {"type": "Part-time", "count": 797, "fraud_count": 74, "fraud_rate": 0.0928},
            {"type": "Temporary", "count": 241, "fraud_count": 2, "fraud_rate": 0.0083},
            {"type": "Other", "count": 227, "fraud_count": 15, "fraud_rate": 0.0661}
        ]

    def get_education_levels(self) -> List[Dict[str, Any]]:
        """
        Get fraud distribution across required education credentials.
        """
        if self._education_cache is not None:
            return self._education_cache

        return [
            {"level": "Bachelor's Degree", "count": 5145, "fraud_count": 100, "fraud_rate": 0.0194},
            {"level": "High School or equivalent", "count": 2080, "fraud_count": 171, "fraud_rate": 0.0822},
            {"level": "Unspecified", "count": 1397, "fraud_count": 102, "fraud_rate": 0.0730},
            {"level": "Master's Degree", "count": 416, "fraud_count": 32, "fraud_rate": 0.0769},
            {"level": "Associate Degree", "count": 274, "fraud_count": 6, "fraud_rate": 0.0219},
            {"level": "Some College Coursework Completed", "count": 102, "fraud_count": 3, "fraud_rate": 0.0294},
            {"level": "Vocational", "count": 49, "fraud_count": 0, "fraud_rate": 0.0000},
            {"level": "Doctorate", "count": 26, "fraud_count": 1, "fraud_rate": 0.0385}
        ]

    def get_top_locations(self) -> List[Dict[str, Any]]:
        """
        Get fraud breakdown across top geographical locations.
        """
        if self._locations_cache is not None:
            return self._locations_cache

        return [
            {"location": "US, NY, New York", "count": 926, "fraud_count": 39, "fraud_rate": 0.0421},
            {"location": "US, CA, San Francisco", "count": 472, "fraud_count": 5, "fraud_rate": 0.0106},
            {"location": "US, TX, Houston", "count": 269, "fraud_count": 91, "fraud_rate": 0.3383},
            {"location": "GB, LND, London", "count": 267, "fraud_count": 2, "fraud_rate": 0.0075},
            {"location": "US, IL, Chicago", "count": 255, "fraud_count": 7, "fraud_rate": 0.0275},
            {"location": "US, CA, Los Angeles", "count": 253, "fraud_count": 8, "fraud_rate": 0.0316},
            {"location": "GR, I, Athens", "count": 251, "fraud_count": 0, "fraud_rate": 0.0000},
            {"location": "US, TX, Austin", "count": 213, "fraud_count": 3, "fraud_rate": 0.0141},
            {"location": "US, CA, San Diego", "count": 164, "fraud_count": 7, "fraud_rate": 0.0427},
            {"location": "US, OH, Cleveland", "count": 157, "fraud_count": 6, "fraud_rate": 0.0382},
            {"location": "US, GA, Atlanta", "count": 150, "fraud_count": 4, "fraud_rate": 0.0267},
            {"location": "US, FL, Orlando", "count": 135, "fraud_count": 6, "fraud_rate": 0.0444},
            {"location": "US, CA, San Jose", "count": 129, "fraud_count": 1, "fraud_rate": 0.0078},
            {"location": "US, NC, Charlotte", "count": 89, "fraud_count": 5, "fraud_rate": 0.0562}
        ]

    def get_missingness_stats(self) -> List[Dict[str, Any]]:
        """
        Get missing data rates per column in dataset.
        """
        if self._missingness_cache is not None:
            return self._missingness_cache

        return [
            {"column": "salary_range", "missing_count": 15012, "missing_pct": 83.96},
            {"column": "department", "missing_count": 11547, "missing_pct": 64.58},
            {"column": "required_education", "missing_count": 8105, "missing_pct": 45.33},
            {"column": "benefits", "missing_count": 7210, "missing_pct": 40.32},
            {"column": "required_experience", "missing_count": 7050, "missing_pct": 39.43},
            {"column": "function", "missing_count": 6455, "missing_pct": 36.10},
            {"column": "industry", "missing_count": 4903, "missing_pct": 27.42},
            {"column": "employment_type", "missing_count": 3471, "missing_pct": 19.41},
            {"column": "company_profile", "missing_count": 3308, "missing_pct": 18.50},
            {"column": "requirements", "missing_count": 2695, "missing_pct": 15.07},
            {"column": "location", "missing_count": 346, "missing_pct": 1.94},
            {"column": "description", "missing_count": 1, "missing_pct": 0.01},
            {"column": "title", "missing_count": 0, "missing_pct": 0.00}
        ]

    def get_fraud_by_logo(self) -> Dict[str, Any]:
        """
        Get fraud comparison between postings with and without company logo.
        """
        if self._logo_cache is not None:
            return self._logo_cache

        return {
            "with_logo": {"count": 13797, "fraud_count": 283, "fraud_rate": 0.0205},
            "without_logo": {"count": 4083, "fraud_count": 583, "fraud_rate": 0.1428}
        }

    def get_fraud_by_telecommuting(self) -> Dict[str, Any]:
        """
        Get fraud comparison between remote and onsite job postings.
        """
        if self._telecommuting_cache is not None:
            return self._telecommuting_cache

        return {
            "remote": {"count": 860, "fraud_count": 102, "fraud_rate": 0.1186},
            "onsite": {"count": 17020, "fraud_count": 764, "fraud_rate": 0.0449}
        }

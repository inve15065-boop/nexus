import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import joblib
import os
import datetime

class NexusPredictiveEngine:
    def __init__(self, model_path='nexus_ai_model.joblib'):
        self.model_path = model_path
        self.model = None
        self.label_encoder = LabelEncoder()
        self.is_trained = False
        
        # Initialize categories
        self.categories = ['Critical', 'At Risk', 'Steady Progress', 'High Potential']
        self.label_encoder.fit(self.categories)
        
        self.load_model()

    def generate_synthetic_data(self, samples=500):
        """Generates synthetic training data to simulate real-world learning"""
        # Features: [Score, Attendance, CourseDifficulty (1-5)]
        X = np.random.randint(0, 101, size=(samples, 3))
        y = []
        
        for row in X:
            score, attendance, difficulty = row
            # Balanced logic: 0-100 scale
            # Max possible: 100*0.7 + 100*0.3 = 100
            # Min possible: 0*0.7 + 0*0.3 - 5*5 = -25
            performance_index = (score * 0.7) + (attendance * 0.3) - (difficulty * 2)
            
            if performance_index >= 75:
                y.append('High Potential')
            elif performance_index >= 55:
                y.append('Steady Progress')
            elif performance_index >= 35:
                y.append('At Risk')
            else:
                y.append('Critical')
                
        return X, np.array(y)

    def train(self):
        """Trains the Random Forest model"""
        print(f"[{datetime.datetime.now()}] Nexus AI: Initiating learning sequence...")
        X, y = self.generate_synthetic_data()
        
        # Encode labels
        y_encoded = self.label_encoder.transform(y)
        
        # Train Random Forest Classifier
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.model.fit(X, y_encoded)
        
        # Save model
        joblib.dump({
            'model': self.model,
            'encoder': self.label_encoder
        }, self.model_path)
        
        self.is_trained = True
        print(f"[{datetime.datetime.now()}] Nexus AI: Training complete. Model optimized.")

    def load_model(self):
        """Loads the model from disk if it exists"""
        if os.path.exists(self.model_path):
            try:
                data = joblib.load(self.model_path)
                self.model = data['model']
                self.label_encoder = data['encoder']
                self.is_trained = True
                print("Nexus AI: Intelligence model loaded successfully.")
            except:
                print("Nexus AI: Model corruption detected. Retraining required.")
                self.train()
        else:
            self.train()

    def predict(self, score, attendance=95, difficulty=3):
        """Performs real-time ML inference"""
        if not self.is_trained:
            self.train()
            
        features = np.array([[score, attendance, difficulty]])
        
        # Get class probabilities
        probs = self.model.predict_proba(features)[0]
        prediction_idx = np.argmax(probs)
        confidence = probs[prediction_idx] * 100
        
        category = self.label_encoder.inverse_transform([prediction_idx])[0]
        
        # Dynamic Recommendations based on ML Output
        recommendations = {
            'High Potential': "Candidate exhibits elite-level mastery. Recommend fast-track to Advanced Honors and peer-mentorship role.",
            'Steady Progress': "Performance is consistent with target benchmarks. Recommend elective focus in specialized modules.",
            'At Risk': "Sub-optimal performance detected. Recommend mandatory attendance in supplemental workshops and 1-on-1 review.",
            'Critical': "Significant performance gap. Immediate intervention required. Mandatory tutoring and curriculum adjustment advised."
        }
        
        return {
            "category": category,
            "prediction": recommendations[category],
            "confidence": f"{confidence:.2f}%",
            "metadata": {
                "score_analyzed": score,
                "attendance_context": attendance,
                "difficulty_weight": difficulty,
                "timestamp": datetime.datetime.now().isoformat()
            }
        }

# Singleton instance
nexus_ai = NexusPredictiveEngine()

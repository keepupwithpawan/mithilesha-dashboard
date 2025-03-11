import pandas as pd
import numpy as np
import json
import os
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from sklearn.preprocessing import MinMaxScaler

# Configuration
DATASET_PATH = "apple_sales_2024.csv"
RESULTS_PATH = "public/data/all_results.json"
SEQ_LENGTH = 10  # 10 days for prediction
TRAIN_RATIO = 0.8  # 80% training data

# Ensure results directory exists
os.makedirs(os.path.dirname(RESULTS_PATH), exist_ok=True)

# Load dataset
df = pd.read_csv(DATASET_PATH)
df["init_time"] = pd.to_datetime(df["init_time"])
df.set_index("init_time", inplace=True)

# Define product columns (excluding prices and discounts)
PRODUCT_COLUMNS = [col for col in df.columns if "Stock" in col]

# Store results
results = {}

def create_sequences(data, seq_length):
    """Generate sequences for LSTM."""
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i:i+seq_length])
        y.append(data[i+seq_length])
    return np.array(X), np.array(y)

def build_lstm_model(input_shape):
    """Create LSTM model."""
    model = Sequential([
        LSTM(64, activation="relu", return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        LSTM(32, activation="relu"),
        Dense(1)
    ])
    model.compile(optimizer=Adam(learning_rate=0.001), loss="mse")
    return model

for product in PRODUCT_COLUMNS:
    print(f"\n📊 Training model for {product}...")

    # Scale data
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(df[[product]])

    # Create sequences for the entire dataset
    X, y = create_sequences(scaled_data, SEQ_LENGTH)
    train_size = int(len(X) * TRAIN_RATIO)

    X_train, X_test = X[:train_size], X[train_size:]
    y_train, y_test = y[:train_size], y[train_size:]

    # Train LSTM model
    model = build_lstm_model((SEQ_LENGTH, 1))
    model.fit(X_train, y_train, epochs=50, batch_size=16, verbose=1)

    # Predict for the ENTIRE dataset
    full_X = create_sequences(scaled_data, SEQ_LENGTH)[0]  # All sequences
    y_pred_full = model.predict(full_X)

    # Inverse transform predictions and actuals
    y_full = scaled_data[SEQ_LENGTH:]  # Actual values aligned with predictions
    y_pred_full_inv = scaler.inverse_transform(y_pred_full)
    y_full_inv = scaler.inverse_transform(y_full)

    # Convert to lists
    dates = df.index[SEQ_LENGTH:].strftime("%Y-%m-%d").tolist()
    actual_sales = y_full_inv.flatten().tolist()
    predicted_sales = [round(num, 2) for num in y_pred_full_inv.flatten().tolist()]

    # Anomaly detection
    threshold = 1.5 * np.std(np.array(actual_sales) - np.array(predicted_sales))
    anomalies = [dates[i] for i in range(len(actual_sales)) if abs(actual_sales[i] - predicted_sales[i]) > threshold]

    # Store results
    results[product] = {
        "dates": dates,
        "actual_sales": actual_sales,
        "predicted_sales": predicted_sales,
        "anomalies": anomalies
    }

# Save to JSON
with open(RESULTS_PATH, "w") as json_file:
    json.dump(results, json_file, indent=4)

print(f"\n✅ Predictions saved to {RESULTS_PATH}")

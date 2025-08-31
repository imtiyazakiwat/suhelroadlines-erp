# SuhelRoadline Travel ERP

A comprehensive iOS-themed mobile application for managing travel operations, including trip entries, advance payments, vehicle management, and reporting for transportation businesses.

## Features

### 🏠 Dashboard
- Real-time metrics display (today's trips, advances, vehicles)
- Quick action buttons for common tasks
- Recent activities overview
- Beautiful iOS-themed gradient design

### ➕ Add Entry
- Auto-increment SL numbers
- Vehicle search and auto-fill driver details
- Multiple village selection with auto-suggest
- Form validation and error handling
- Real-time data sync with Firebase

### 💰 Add Advance
- Vehicle-based trip selection
- Trip-advance mapping and tracking
- Previous advances display
- Settlement status tracking
- Real-time balance calculations

### 📊 Reports
- Advanced filtering (date range, vehicle, village)
- Trip-wise advance breakdown
- Summary statistics
- CSV export functionality
- Responsive data visualization

### ⚙️ Settings
- Vehicle management (CRUD operations)
- Driver contact management
- Village management
- VCF export for driver contacts
- App preferences and settings

## Technology Stack

- **Frontend**: React 19.1.1 with Framework7 React (iOS UI components)
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **Styling**: iOS-themed CSS with purple/teal gradient design
- **Icons**: Framework7 iOS icons
- **Export**: CSV and VCF file generation
- **Date Handling**: date-fns library

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd srl-2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Enable Firestore Database, Authentication, and Storage
   - Copy your Firebase configuration
   - Update `src/firebase/config.js` with your Firebase credentials:

   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "your-app-id"
   };
   ```

4. **Set up Firestore Security Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true; // Configure based on your security needs
       }
     }
   }
   ```

5. **Start the development server**
   ```bash
   npm start
   ```

6. **Open the application**
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - The app will automatically reload when you make changes

## Project Structure

```
srl-2/
├── public/
│   ├── index.html
│   └── ...
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── AppLayout.js
│   │   │   └── AppLayout.css
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.js
│   │   │   └── Dashboard.css
│   │   ├── AddEntry/
│   │   │   ├── AddEntry.js
│   │   │   └── AddEntry.css
│   │   ├── AddAdvance/
│   │   │   ├── AddAdvance.js
│   │   │   └── AddAdvance.css
│   │   ├── Reports/
│   │   │   ├── Reports.js
│   │   │   └── Reports.css
│   │   └── Settings/
│   │       ├── Settings.js
│   │       └── Settings.css
│   ├── firebase/
│   │   └── config.js
│   ├── services/
│   │   └── firebaseService.js
│   ├── types/
│   │   └── index.js
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── userinput.py
├── package.json
└── README.md
```

## Data Models

### Trip Entry
```javascript
{
  id: string,
  slNumber: number,
  date: Date,
  vehicleNumber: string,
  strNumber: string,
  villages: Array<string>,
  quantity: number,
  driverName: string,
  mobileNumber: string,
  advanceAmount: number,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Vehicle
```javascript
{
  vehicleNumber: string,
  driverName: string,
  mobileNumber: string,
  isActive: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Advance
```javascript
{
  id: string,
  vehicleNumber: string,
  tripId: string,
  tripDate: Date,
  advanceAmount: number,
  note: string,
  isSettled: boolean,
  createdAt: timestamp
}
```

## Firebase Collections

- `/trips` - All trip entries
- `/vehicles` - Vehicle and driver information
- `/advances` - Advance payment records
- `/tripAdvances` - Trip-wise advance summaries
- `/villages` - Village master data
- `/appSettings` - Application settings

## Usage Guide

### Adding a Trip Entry
1. Navigate to "Add Entry" from dashboard or bottom navigation
2. SL number is auto-generated
3. Select vehicle (auto-fills driver details)
4. Enter STR number and select villages
5. Add quantity and advance amount
6. Submit to save

### Managing Advances
1. Go to "Add Advance" section
2. Select vehicle to load associated trips
3. Choose specific trip for advance mapping
4. Enter advance amount and optional note
5. View existing advances for the trip
6. Submit to record advance

### Generating Reports
1. Access "Reports" from navigation
2. Use quick filters (Today, Week, Month, Year)
3. Apply custom date ranges and filters
4. Switch between Trips and Advances view
5. Export data as CSV for external analysis

### Managing Settings
1. Open "Settings" section
2. Manage vehicles (add, edit, delete)
3. Manage villages and usage statistics
4. Export driver contacts as VCF file
5. Configure app preferences

## Development

### Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm eject` - Eject from Create React App

### Key Features Implementation

- **iOS Design**: Framework7 React components with custom iOS theming
- **Real-time Data**: Firebase Firestore with real-time listeners
- **Offline Support**: Service worker for basic offline functionality
- **Responsive Design**: Mobile-first approach with desktop compatibility
- **Data Export**: CSV and VCF export capabilities
- **Form Validation**: Comprehensive client-side validation
- **Error Handling**: Graceful error handling with user feedback

## Deployment

### Firebase Hosting
```bash
npm run build
firebase deploy
```

### Other Platforms
The built static files in the `build` directory can be deployed to any static hosting service.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.

---

**SuhelRoadline Travel ERP v1.0** - Built with ❤️ for efficient transportation management
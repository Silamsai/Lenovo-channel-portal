import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth, RequireRole } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { FundingList } from './pages/FundingList';
import { FundingRequestPage } from './pages/FundingRequest';
import { MyCampaigns } from './pages/MyCampaigns';
import { CampaignJourney } from './pages/CampaignJourney';
import { CampaignLibrary } from './pages/CampaignLibrary';
import { KitDetail } from './pages/KitDetail';
import { Customise } from './pages/Customise';
import { Enablement } from './pages/Enablement';
import { ReviewQueuePage } from './pages/ReviewQueue';
import { Reports } from './pages/Reports';
import { Partners } from './pages/Partners';
import { PartnerProfile } from './pages/PartnerProfile';
import { Benefits } from './pages/Benefits';
import { Rewards } from './pages/Rewards';
import { Administration } from './pages/Administration';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'funding', element: <FundingList tab="funding" /> },
          { path: 'claims', element: <FundingList tab="claims" /> },
          { path: 'funding/:id', element: <FundingRequestPage /> },
          { path: 'campaigns/:fid/:step?', element: <CampaignJourney /> },
          { path: 'library', element: <CampaignLibrary /> },
          { path: 'library/:slug', element: <KitDetail /> },
          { path: 'reports', element: <Reports /> },
          {
            element: <RequireRole role="PARTNER" />,
            children: [
              { path: 'funding/new', element: <FundingRequestPage /> },
              { path: 'campaigns', element: <MyCampaigns /> },
              { path: 'library/:slug/customise', element: <Customise /> },
              { path: 'enablement', element: <Enablement /> },
              { path: 'profile', element: <PartnerProfile /> },
              { path: 'benefits', element: <Benefits /> },
              { path: 'rewards', element: <Rewards /> },
            ],
          },
          {
            element: <RequireRole role="REVIEWER" />,
            children: [
              { path: 'review', element: <ReviewQueuePage /> },
              { path: 'partners', element: <Partners /> },
              { path: 'partners/:id', element: <PartnerProfile /> },
              { path: 'administration', element: <Administration /> },
            ],
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);

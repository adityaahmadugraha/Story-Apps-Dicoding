import HomePage from "../pages/home/home-page";
import AddPage from "../pages/add/add-page";
import LoginPage from "../pages/login/login-page";
import RegisterPage from "../pages/register/register-page";
import SavedPage from "../pages/saved/saved-page";

const routes = {
  "/": new HomePage(),
  "/add": new AddPage(),
  "/login": new LoginPage(),
  "/register": new RegisterPage(),
  "/saved": new SavedPage(),
};

export default routes;

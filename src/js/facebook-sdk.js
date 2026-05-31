document.addEventListener("DOMContentLoaded", function () {
	const fjs = document.getElementsByTagName("script")[0];
	if (!fjs || document.getElementById("facebook-jssdk")) return;

	const js = document.createElement("script");
	js.id = "facebook-jssdk";
	js.src = "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.0";
	fjs.parentNode?.insertBefore(js, fjs);
});
